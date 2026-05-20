/**
 * Formula / calculation field engine.
 *
 * Shared between the document editor (validation + preview), the signing flow
 * (real-time display) and the server (authoritative computation at completion).
 *
 * Supported syntax:
 * - Numeric literals: `12`, `0.655`
 * - Field references: `{Label}` — references another field by its label
 * - Operators: `+` `-` `*` `/` and parentheses `(` `)`
 * - Functions: `SUM(a, b, ...)`, `ROUND(x, decimals?)`, `MIN(a, ...)`, `MAX(a, ...)`
 *
 * Missing / blank / non-numeric references are treated as `0` so that calculated
 * fields show a running total as referenced fields are filled in.
 */

export const FORMULA_FUNCTIONS = ['SUM', 'ROUND', 'MIN', 'MAX'] as const;

export type FormulaFunction = (typeof FORMULA_FUNCTIONS)[number];

/**
 * A normalized view of a field for the purposes of formula evaluation.
 *
 * Callers (editor / signing / server) map their own field shapes into this.
 */
export type FormulaFieldInput = {
  /** The label used to reference this field from a formula. */
  label: string;
  /** Whether this field is itself a calculated field. */
  isCalculated: boolean;
  /** The current numeric value for non-calculated numeric fields (null if unset). */
  numericValue: number | null;
  /** The formula string for calculated fields. */
  formula?: string;
};

type Token =
  | { type: 'number'; value: number }
  | { type: 'ref'; value: string }
  | { type: 'func'; value: FormulaFunction }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' };

export class FormulaError extends Error {}

const isFormulaFunction = (value: string): value is FormulaFunction =>
  (FORMULA_FUNCTIONS as readonly string[]).includes(value);

/**
 * Tokenize a formula string. Throws {@link FormulaError} on invalid characters.
 */
const tokenize = (formula: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      i += 1;
      continue;
    }

    if (char === '{') {
      const end = formula.indexOf('}', i);

      if (end === -1) {
        throw new FormulaError('Unterminated field reference (missing "}")');
      }

      const label = formula.slice(i + 1, end).trim();

      if (!label) {
        throw new FormulaError('Empty field reference "{}"');
      }

      tokens.push({ type: 'ref', value: label });
      i = end + 1;
      continue;
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'op', value: char });
      i += 1;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      i += 1;
      continue;
    }

    if (char === ',') {
      tokens.push({ type: 'comma' });
      i += 1;
      continue;
    }

    // Numeric literal.
    if ((char >= '0' && char <= '9') || char === '.') {
      let j = i;
      let seenDot = false;

      while (j < formula.length) {
        const c = formula[j];

        if (c >= '0' && c <= '9') {
          j += 1;
        } else if (c === '.' && !seenDot) {
          seenDot = true;
          j += 1;
        } else {
          break;
        }
      }

      const slice = formula.slice(i, j);
      const value = Number(slice);

      if (Number.isNaN(value)) {
        throw new FormulaError(`Invalid number "${slice}"`);
      }

      tokens.push({ type: 'number', value });
      i = j;
      continue;
    }

    // Function name.
    if (/[A-Za-z_]/.test(char)) {
      let j = i;

      while (j < formula.length && /[A-Za-z0-9_]/.test(formula[j])) {
        j += 1;
      }

      const name = formula.slice(i, j).toUpperCase();

      if (!isFormulaFunction(name)) {
        throw new FormulaError(
          `Unknown function "${formula.slice(i, j)}". Use a field reference like {Label}, or one of: ${FORMULA_FUNCTIONS.join(', ')}`,
        );
      }

      tokens.push({ type: 'func', value: name });
      i = j;
      continue;
    }

    throw new FormulaError(`Unexpected character "${char}"`);
  }

  return tokens;
};

/** Resolve a referenced field's label to a number. Missing -> null. */
export type ReferenceResolver = (label: string) => number | null;

/**
 * Parse and evaluate a token stream with a recursive-descent parser.
 *
 * Grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := NUMBER | REF | FUNC '(' args ')' | '(' expr ')' | '-' factor
 *   args   := expr (',' expr)*
 */
const evaluateTokens = (tokens: Token[], resolve: ReferenceResolver): number => {
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const next = (): Token | undefined => tokens[pos++];

  const parseExpr = (): number => {
    let value = parseTerm();

    let token = peek();
    while (token && token.type === 'op' && (token.value === '+' || token.value === '-')) {
      next();
      const right = parseTerm();
      value = token.value === '+' ? value + right : value - right;
      token = peek();
    }

    return value;
  };

  const parseTerm = (): number => {
    let value = parseFactor();

    let token = peek();
    while (token && token.type === 'op' && (token.value === '*' || token.value === '/')) {
      next();
      const right = parseFactor();
      value = token.value === '*' ? value * right : value / right;
      token = peek();
    }

    return value;
  };

  const parseArgs = (): number[] => {
    const args: number[] = [];

    // Empty argument list.
    const lookahead = peek();
    if (lookahead && lookahead.type === 'paren' && lookahead.value === ')') {
      return args;
    }

    args.push(parseExpr());

    let token = peek();
    while (token && token.type === 'comma') {
      next();
      args.push(parseExpr());
      token = peek();
    }

    return args;
  };

  const applyFunction = (fn: FormulaFunction, args: number[]): number => {
    switch (fn) {
      case 'SUM':
        return args.reduce((acc, value) => acc + value, 0);
      case 'MIN':
        if (args.length === 0) {
          throw new FormulaError('MIN() requires at least one argument');
        }
        return Math.min(...args);
      case 'MAX':
        if (args.length === 0) {
          throw new FormulaError('MAX() requires at least one argument');
        }
        return Math.max(...args);
      case 'ROUND': {
        if (args.length < 1 || args.length > 2) {
          throw new FormulaError('ROUND(value, decimals?) takes 1 or 2 arguments');
        }
        const [value, decimals = 0] = args;
        const factor = Math.pow(10, Math.max(0, Math.trunc(decimals)));
        return Math.round(value * factor) / factor;
      }
    }
  };

  const parseFactor = (): number => {
    const token = next();

    if (!token) {
      throw new FormulaError('Unexpected end of formula');
    }

    if (token.type === 'number') {
      return token.value;
    }

    if (token.type === 'ref') {
      return resolve(token.value) ?? 0;
    }

    if (token.type === 'op' && token.value === '-') {
      return -parseFactor();
    }

    if (token.type === 'op' && token.value === '+') {
      return parseFactor();
    }

    if (token.type === 'paren' && token.value === '(') {
      const value = parseExpr();
      const closing = next();

      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new FormulaError('Missing closing ")"');
      }

      return value;
    }

    if (token.type === 'func') {
      const opening = next();

      if (!opening || opening.type !== 'paren' || opening.value !== '(') {
        throw new FormulaError(`Expected "(" after ${token.value}`);
      }

      const args = parseArgs();
      const closing = next();

      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new FormulaError(`Missing closing ")" for ${token.value}`);
      }

      return applyFunction(token.value, args);
    }

    throw new FormulaError('Unexpected token in formula');
  };

  const result = parseExpr();

  if (pos !== tokens.length) {
    throw new FormulaError('Unexpected trailing input in formula');
  }

  return result;
};

/**
 * Extract the field labels referenced by a formula. Returns an empty array for
 * formulas that fail to tokenize.
 */
export const extractFormulaReferences = (formula: string): string[] => {
  try {
    const refs = tokenize(formula)
      .filter((token): token is Extract<Token, { type: 'ref' }> => token.type === 'ref')
      .map((token) => token.value);

    return Array.from(new Set(refs));
  } catch {
    return [];
  }
};

export type FormulaValidationResult = { valid: true } | { valid: false; error: string };

/**
 * Validate a formula's syntax (without evaluating it against real values).
 */
export const validateFormulaSyntax = (formula: string): FormulaValidationResult => {
  if (!formula.trim()) {
    return { valid: false, error: 'Formula is empty' };
  }

  try {
    // Resolve every reference to 1 so syntax (and div-by-zero aside) is exercised.
    evaluateTokens(tokenize(formula), () => 1);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof FormulaError ? error.message : 'Invalid formula',
    };
  }
};

/**
 * Detect circular references among calculated fields.
 *
 * Returns the set of labels that participate in a cycle (including
 * self-references). An empty set means the formulas are acyclic.
 */
export const detectCircularReferences = (
  calculatedFields: { label: string; formula: string }[],
): Set<string> => {
  const formulaByLabel = new Map<string, string>();

  for (const field of calculatedFields) {
    if (field.label) {
      formulaByLabel.set(field.label, field.formula);
    }
  }

  const inCycle = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (label: string, stack: string[]): void => {
    if (visiting.has(label)) {
      // Found a back-edge; everything from `label` onward in the stack is a cycle.
      const start = stack.indexOf(label);
      for (const node of stack.slice(start)) {
        inCycle.add(node);
      }
      return;
    }

    if (visited.has(label)) {
      return;
    }

    const formula = formulaByLabel.get(label);

    // Not a calculated field — nothing to traverse.
    if (formula === undefined) {
      return;
    }

    visiting.add(label);

    for (const ref of extractFormulaReferences(formula)) {
      dfs(ref, [...stack, label]);
    }

    visiting.delete(label);
    visited.add(label);
  };

  for (const label of formulaByLabel.keys()) {
    dfs(label, []);
  }

  return inCycle;
};

/**
 * Build a resolver over a set of fields that recursively evaluates calculated
 * fields (with cycle protection) and returns numeric field values.
 */
const buildResolver = (inputs: FormulaFieldInput[]): ReferenceResolver => {
  const byLabel = new Map<string, FormulaFieldInput>();

  for (const input of inputs) {
    // First definition for a label wins.
    if (input.label && !byLabel.has(input.label)) {
      byLabel.set(input.label, input);
    }
  }

  const resolve = (label: string, visiting: Set<string>): number | null => {
    const input = byLabel.get(label);

    if (!input) {
      return null;
    }

    if (!input.isCalculated) {
      return input.numericValue;
    }

    // Circular reference — treat as 0 to avoid infinite recursion.
    if (visiting.has(label)) {
      return 0;
    }

    if (!input.formula?.trim()) {
      return null;
    }

    visiting.add(label);

    try {
      return evaluateTokens(tokenize(input.formula), (ref) => resolve(ref, visiting) ?? 0);
    } catch {
      return null;
    } finally {
      visiting.delete(label);
    }
  };

  return (label: string) => resolve(label, new Set());
};

export type CalculatedValueResult = {
  /** The numeric result, or null if it could not be computed. */
  value: number | null;
  /** The formatted, display-ready string (empty when not computable). */
  display: string;
  /** A human readable error, when the formula is invalid. */
  error?: string;
};

/**
 * Format a numeric result honouring the requested precision (decimal places).
 */
export const formatCalculatedValue = (value: number, precision?: number | null): string => {
  if (!Number.isFinite(value)) {
    return '';
  }

  if (precision === undefined || precision === null) {
    // Trim floating point noise while keeping the natural precision.
    return String(Math.round(value * 1e10) / 1e10);
  }

  return value.toFixed(Math.max(0, Math.trunc(precision)));
};

/**
 * Evaluate a single calculated field's formula against the provided fields.
 *
 * @param formula     The calculated field's formula.
 * @param inputs      Every field that may be referenced (numeric + calculated).
 * @param precision   Decimal places for the formatted output.
 * @param ownLabel    The calculated field's own label (used to guard against
 *                    self-references during evaluation).
 */
export const evaluateCalculatedField = (
  formula: string,
  inputs: FormulaFieldInput[],
  precision?: number | null,
  ownLabel?: string,
): CalculatedValueResult => {
  if (!formula?.trim()) {
    return { value: null, display: '', error: 'Formula is empty' };
  }

  const resolve = buildResolver(inputs);
  const visiting = new Set<string>(ownLabel ? [ownLabel] : []);

  try {
    const value = evaluateTokens(tokenize(formula), (ref) => {
      // Guard against a field referencing itself.
      if (visiting.has(ref)) {
        return 0;
      }
      return resolve(ref) ?? 0;
    });

    if (!Number.isFinite(value)) {
      return { value: null, display: '' };
    }

    return { value, display: formatCalculatedValue(value, precision) };
  } catch (error) {
    return {
      value: null,
      display: '',
      error: error instanceof FormulaError ? error.message : 'Invalid formula',
    };
  }
};
