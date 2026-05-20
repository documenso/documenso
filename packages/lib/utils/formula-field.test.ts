import { describe, expect, it } from 'vitest';

import {
  type FormulaFieldInput,
  detectCircularReferences,
  evaluateCalculatedField,
  extractFormulaReferences,
  formatCalculatedValue,
  validateFormulaSyntax,
} from './formula-field';

const num = (label: string, value: number | null): FormulaFieldInput => ({
  label,
  isCalculated: false,
  numericValue: value,
});

const calc = (label: string, formula: string): FormulaFieldInput => ({
  label,
  isCalculated: true,
  numericValue: null,
  formula,
});

describe('evaluateCalculatedField', () => {
  describe('arithmetic', () => {
    it('supports addition, subtraction, multiplication and division', () => {
      const inputs = [num('a', 10), num('b', 4)];

      expect(evaluateCalculatedField('{a} + {b}', inputs, 0).value).toBe(14);
      expect(evaluateCalculatedField('{a} - {b}', inputs, 0).value).toBe(6);
      expect(evaluateCalculatedField('{a} * {b}', inputs, 0).value).toBe(40);
      expect(evaluateCalculatedField('{a} / {b}', inputs, 2).value).toBe(2.5);
    });

    it('respects operator precedence and parentheses', () => {
      const inputs = [num('a', 2), num('b', 3), num('c', 4)];

      expect(evaluateCalculatedField('{a} + {b} * {c}', inputs, 0).value).toBe(14);
      expect(evaluateCalculatedField('({a} + {b}) * {c}', inputs, 0).value).toBe(20);
    });

    it('handles numeric literals and unary minus', () => {
      const inputs = [num('miles', 100)];

      expect(evaluateCalculatedField('{miles} * 0.655', inputs, 2).value).toBeCloseTo(65.5);
      expect(evaluateCalculatedField('-{miles} + 10', inputs, 0).value).toBe(-90);
    });
  });

  describe('functions', () => {
    const inputs = [num('a', 3), num('b', 7), num('c', 5)];

    it('SUM adds all arguments', () => {
      expect(evaluateCalculatedField('SUM({a}, {b}, {c})', inputs, 0).value).toBe(15);
    });

    it('MIN and MAX', () => {
      expect(evaluateCalculatedField('MIN({a}, {b}, {c})', inputs, 0).value).toBe(3);
      expect(evaluateCalculatedField('MAX({a}, {b}, {c})', inputs, 0).value).toBe(7);
    });

    it('ROUND with and without explicit decimals', () => {
      expect(evaluateCalculatedField('ROUND(3.14159, 2)', [], 2).value).toBeCloseTo(3.14);
      expect(evaluateCalculatedField('ROUND(3.7)', [], 0).value).toBe(4);
    });

    it('functions are case-insensitive', () => {
      expect(evaluateCalculatedField('sum({a}, {b})', inputs, 0).value).toBe(10);
    });
  });

  describe('partial / missing values', () => {
    it('treats unfilled references as 0 for a running total', () => {
      const inputs = [num('a', 10), num('b', null)];

      expect(evaluateCalculatedField('{a} + {b}', inputs, 0).value).toBe(10);
    });

    it('returns an empty display for an empty formula', () => {
      expect(evaluateCalculatedField('', [], 2).display).toBe('');
    });

    it('returns empty for division by zero', () => {
      const inputs = [num('a', 10), num('b', 0)];

      expect(evaluateCalculatedField('{a} / {b}', inputs, 2).value).toBeNull();
      expect(evaluateCalculatedField('{a} / {b}', inputs, 2).display).toBe('');
    });
  });

  describe('nested calculated fields', () => {
    it('resolves references to other calculated fields', () => {
      const inputs = [num('hours', 8), num('rate', 20), calc('gross', '{hours} * {rate}')];

      // tax = gross * 0.1 -> 16
      expect(evaluateCalculatedField('{gross} * 0.1', inputs, 2).value).toBeCloseTo(16);
    });
  });

  describe('formatting / precision', () => {
    it('formats with the requested decimal places', () => {
      const inputs = [num('a', 1), num('b', 3)];

      expect(evaluateCalculatedField('{a} / {b}', inputs, 2).display).toBe('0.33');
      expect(evaluateCalculatedField('{a} / {b}', inputs, 4).display).toBe('0.3333');
    });
  });

  describe('invalid formulas', () => {
    it('reports an error for unknown functions', () => {
      const result = evaluateCalculatedField('FOO(1, 2)', [], 0);

      expect(result.value).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('reports an error for unbalanced parentheses', () => {
      expect(evaluateCalculatedField('(1 + 2', [], 0).error).toBeDefined();
    });
  });
});

describe('extractFormulaReferences', () => {
  it('returns unique referenced labels', () => {
    expect(extractFormulaReferences('{a} + {b} + {a}')).toEqual(['a', 'b']);
  });

  it('returns an empty array for malformed formulas', () => {
    expect(extractFormulaReferences('{a} + {')).toEqual([]);
  });
});

describe('validateFormulaSyntax', () => {
  it('accepts a valid formula', () => {
    expect(validateFormulaSyntax('{a} * 2 + ROUND({b}, 1)')).toEqual({ valid: true });
  });

  it('rejects an empty formula', () => {
    expect(validateFormulaSyntax('')).toMatchObject({ valid: false });
  });

  it('rejects invalid syntax', () => {
    expect(validateFormulaSyntax('{a} +')).toMatchObject({ valid: false });
  });
});

describe('detectCircularReferences', () => {
  it('detects a direct cycle between two calculated fields', () => {
    const cycles = detectCircularReferences([
      { label: 'x', formula: '{y} + 1' },
      { label: 'y', formula: '{x} + 1' },
    ]);

    expect(cycles.has('x')).toBe(true);
    expect(cycles.has('y')).toBe(true);
  });

  it('detects a self-reference', () => {
    const cycles = detectCircularReferences([{ label: 'x', formula: '{x} + 1' }]);

    expect(cycles.has('x')).toBe(true);
  });

  it('returns no cycles for an acyclic graph', () => {
    const cycles = detectCircularReferences([
      { label: 'gross', formula: '{hours} * {rate}' },
      { label: 'net', formula: '{gross} - {tax}' },
    ]);

    expect(cycles.size).toBe(0);
  });
});

describe('formatCalculatedValue', () => {
  it('honours precision', () => {
    expect(formatCalculatedValue(3.14159, 2)).toBe('3.14');
    expect(formatCalculatedValue(10, 0)).toBe('10');
  });

  it('trims floating point noise without precision', () => {
    expect(formatCalculatedValue(0.1 + 0.2)).toBe('0.3');
  });

  it('returns empty for non-finite values', () => {
    expect(formatCalculatedValue(Infinity, 2)).toBe('');
  });
});
