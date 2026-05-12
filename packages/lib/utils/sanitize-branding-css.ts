import type { AtRule, Container, Declaration, Rule } from 'postcss';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { z } from 'zod';

export const ZSanitizeBrandingCssWarningSchema = z.object({
  kind: z.enum(['selector', 'property', 'value', 'at-rule', 'parse-error']),
  detail: z.string(),
  line: z.number().optional(),
});

export type SanitizeBrandingCssWarning = z.infer<typeof ZSanitizeBrandingCssWarningSchema>;

export type SanitizeBrandingCssResult = {
  css: string;
  warnings: SanitizeBrandingCssWarning[];
};

/**
 * The class name the sanitised CSS will be wrapped in at render time using
 * CSS nesting (`.documenso-branded { <user css> }`). The sanitiser itself
 * does NOT prefix selectors — the wrapper is applied by `RecipientBranding`
 * on every render so we keep the user's original CSS intact in the database.
 */
export const SANITIZE_BRANDING_SCOPE_CLASS = 'documenso-branded';

const BLOCKED_PROPERTIES = new Set([
  'display',
  'visibility',
  'opacity',
  'pointer-events',
  'position',
  'inset',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'transform',
  'clip',
  'clip-path',
  'mask',
  'mask-image',
  'content',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'overflow',
  'overflow-x',
  'overflow-y',
  'font-size',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'text-indent',
]);

const BLOCKED_VALUE_SUBSTRINGS = ['url(', 'expression(', '@import', 'javascript:'];

const BLOCKED_PSEUDO_ELEMENTS = new Set([
  '::before',
  '::after',
  '::backdrop',
  '::marker',
  // Single-colon legacy forms.
  ':before',
  ':after',
]);

const BLOCKED_AT_RULES = new Set([
  'import',
  'font-face',
  'keyframes',
  'charset',
  'namespace',
  'supports',
  'page',
  'document',
  'viewport',
]);

type SelectorValidationResult = { kind: 'ok' } | { kind: 'drop'; reason: string };

/**
 * Validate a selector for the rules we care about, but DO NOT rewrite it.
 * The sanitised output is later wrapped in `.documenso-branded { ... }` via
 * native CSS nesting by `RecipientBranding`, so scoping happens at render.
 */
const validateSelector = (rawSelector: string): SelectorValidationResult => {
  let dropReason: string | null = null;

  const transform = selectorParser((selectors) => {
    selectors.each((selector) => {
      selector.walk((node) => {
        // Pseudo-element check (works at any depth — even nested pseudos like
        // `:is(::before)` should be rejected).
        if (node.type === 'pseudo') {
          const value = node.value;

          if (BLOCKED_PSEUDO_ELEMENTS.has(value)) {
            dropReason = `pseudo-element "${value}" not allowed`;
          }
        }
      });

      if (dropReason !== null) {
        return;
      }

      // Universal selector check — only when it is a direct child of the
      // top-level compound (i.e. `* { ... }` or `* .foo { ... }`).
      // Universal nodes nested inside attribute selectors (`[class*="x"]`)
      // are a different node type and won't appear here.
      selector.each((node) => {
        if (node.type === 'universal') {
          dropReason = 'universal "*" selector not allowed';
        }
      });
    });
  });

  try {
    // We don't keep the result — we only care about parsing and walking
    // to populate dropReason.
    transform.processSync(rawSelector);
  } catch (error) {
    return {
      kind: 'drop',
      reason: error instanceof Error ? error.message : 'failed to parse selector',
    };
  }

  if (dropReason !== null) {
    return { kind: 'drop', reason: dropReason };
  }

  return { kind: 'ok' };
};

const valueIsBlocked = (rawValue: string): boolean => {
  const lowered = rawValue.toLowerCase();

  return BLOCKED_VALUE_SUBSTRINGS.some((needle) => lowered.includes(needle));
};

const sanitizeDeclarations = (container: Container, warnings: SanitizeBrandingCssWarning[]): void => {
  const toRemove: Declaration[] = [];

  container.each((node) => {
    if (node.type !== 'decl') {
      return;
    }

    const decl = node;
    const propLower = decl.prop.toLowerCase();

    if (BLOCKED_PROPERTIES.has(propLower)) {
      warnings.push({
        kind: 'property',
        detail: `property "${decl.prop}" is not allowed`,
        line: decl.source?.start?.line,
      });
      toRemove.push(decl);

      return;
    }

    if (valueIsBlocked(decl.value)) {
      warnings.push({
        kind: 'value',
        detail: `value of "${decl.prop}" contains a disallowed token`,
        line: decl.source?.start?.line,
      });
      toRemove.push(decl);

      return;
    }

    if (decl.important) {
      decl.important = false;
    }
  });

  for (const decl of toRemove) {
    decl.remove();
  }
};

const sanitizeRule = (rule: Rule, warnings: SanitizeBrandingCssWarning[]): void => {
  const line = rule.source?.start?.line;
  const validation = validateSelector(rule.selector);

  if (validation.kind === 'drop') {
    warnings.push({ kind: 'selector', detail: validation.reason, line });
    rule.remove();

    return;
  }

  // Selector is left as-is. Scoping is applied at render time by wrapping
  // the entire sanitised CSS in `.documenso-branded { ... }` (CSS nesting).

  sanitizeDeclarations(rule, warnings);

  // If the rule has no declarations left, leave the empty rule in place — the
  // output is still valid CSS and the user can see what happened. (Removing
  // it would also be acceptable; we keep it to make warnings easier to map.)
};

const sanitizeAtRule = (atRule: AtRule, warnings: SanitizeBrandingCssWarning[]): void => {
  const name = atRule.name.toLowerCase();
  const line = atRule.source?.start?.line;

  if (BLOCKED_AT_RULES.has(name)) {
    warnings.push({
      kind: 'at-rule',
      detail: `at-rule "@${atRule.name}" is not allowed`,
      line,
    });
    atRule.remove();

    return;
  }

  if (name !== 'media') {
    warnings.push({
      kind: 'at-rule',
      detail: `at-rule "@${atRule.name}" is not allowed`,
      line,
    });
    atRule.remove();

    return;
  }

  // Recurse into @media children.
  const children = atRule.nodes ? [...atRule.nodes] : [];

  for (const child of children) {
    if (child.type === 'rule') {
      sanitizeRule(child, warnings);
    } else if (child.type === 'atrule') {
      sanitizeAtRule(child, warnings);
    }
    // Comments and stray declarations inside @media are left alone /
    // declarations directly under @media are invalid CSS anyway.
  }
};

/**
 * Defence in depth against `<style>` element breakout.
 *
 * The sanitised CSS is inlined into a `<style>` element via SSR
 * `dangerouslySetInnerHTML`. The browser's HTML parser (in RAWTEXT mode for
 * `<style>` content) terminates the element on a literal `</style` —
 * regardless of whether it appears inside a CSS string, comment, or at-rule
 * params. PostCSS's serializer escapes `<` to `\3c` whenever it would form
 * `</...`, which means a normal round-trip is already safe.
 *
 * That escape is implicit in PostCSS, not enforced by our own logic. If a
 * future PostCSS version, plugin, or alternative serializer regresses, we
 * still want the output to be safe to inline. This regex is the explicit
 * tripwire — case-insensitive `</style` anywhere in the final output is a
 * hard fail.
 */
const STYLE_CLOSE_TAG_REGEX = /<\s*\/\s*style/i;

export const sanitizeBrandingCss = (input: string): SanitizeBrandingCssResult => {
  const warnings: SanitizeBrandingCssWarning[] = [];

  if (input.trim() === '') {
    return { css: '', warnings };
  }

  let root;

  try {
    root = postcss.parse(input);
  } catch (error) {
    return {
      css: '',
      warnings: [
        {
          kind: 'parse-error',
          detail: error instanceof Error ? error.message : 'failed to parse CSS',
        },
      ],
    };
  }

  // Iterate over a snapshot of top-level children so removal during the loop
  // is safe.
  const topLevelChildren = root.nodes ? [...root.nodes] : [];

  for (const node of topLevelChildren) {
    if (node.type === 'rule') {
      sanitizeRule(node, warnings);
    } else if (node.type === 'atrule') {
      sanitizeAtRule(node, warnings);
    }
    // Top-level decls / comments are left as-is.
  }

  const output = root.toString();

  if (STYLE_CLOSE_TAG_REGEX.test(output)) {
    return {
      css: '',
      warnings: [
        ...warnings,
        {
          kind: 'parse-error',
          detail: 'output contained a literal </style sequence and was rejected',
        },
      ],
    };
  }

  return { css: output, warnings };
};
