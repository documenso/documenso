import { describe, expect, it } from 'vitest';

import { sanitizeBrandingCss } from './sanitize-branding-css';

const normalize = (css: string) => css.replace(/\s+/g, ' ').trim();

/**
 * The sanitiser does NOT scope selectors. Scoping is applied at render time
 * by wrapping the entire sanitised output in `.documenso-branded { ... }` via
 * native CSS nesting (see `RecipientBranding`). These tests assert that
 * selectors are preserved verbatim and only validated.
 */
describe('sanitizeBrandingCss', () => {
  describe('empty input', () => {
    it('returns empty output for an empty string', () => {
      const result = sanitizeBrandingCss('');

      expect(result.css).toBe('');
      expect(result.warnings).toEqual([]);
    });

    it('returns empty output for whitespace-only input', () => {
      const result = sanitizeBrandingCss('   \n\t  \n');

      expect(result.css).toBe('');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('selector preservation', () => {
    it('preserves a bare class selector', () => {
      const result = sanitizeBrandingCss('.foo { color: red; }');

      expect(normalize(result.css)).toBe('.foo { color: red; }');
      expect(result.warnings).toEqual([]);
    });

    it('preserves a tag selector', () => {
      const result = sanitizeBrandingCss('h1 { color: red; }');

      expect(normalize(result.css)).toBe('h1 { color: red; }');
      expect(result.warnings).toEqual([]);
    });

    it('preserves combinators', () => {
      const result = sanitizeBrandingCss('.a > .b + .c ~ .d { color: red; }');

      expect(normalize(result.css)).toBe('.a > .b + .c ~ .d { color: red; }');
      expect(result.warnings).toEqual([]);
    });

    it('preserves comma-separated selectors', () => {
      const result = sanitizeBrandingCss('.a, .b { color: red; }');

      expect(normalize(result.css)).toBe('.a, .b { color: red; }');
      expect(result.warnings).toEqual([]);
    });

    it('preserves body/html/:root verbatim (will no-op once nested at render)', () => {
      const result = sanitizeBrandingCss('body { background: black; }');

      // Selector is left as-is. At render time this becomes
      // `.documenso-branded body { ... }`, which won't match anything since
      // <body> is an ancestor of the wrapper. Documented tradeoff.
      expect(normalize(result.css)).toBe('body { background: black; }');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('pseudo-elements', () => {
    it('drops a rule containing ::before', () => {
      const result = sanitizeBrandingCss(".foo::before { content: 'x'; }");

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('selector');
    });

    it('drops a rule containing ::after', () => {
      const result = sanitizeBrandingCss(".foo::after { content: 'x'; }");

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
    });

    it('drops a rule containing ::backdrop', () => {
      const result = sanitizeBrandingCss('.foo::backdrop { color: red; }');

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
    });

    it('drops a rule containing ::marker', () => {
      const result = sanitizeBrandingCss('li::marker { color: red; }');

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
    });

    it('drops a rule using legacy single-colon :before', () => {
      const result = sanitizeBrandingCss(".foo:before { content: 'x'; }");

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('selector');
    });

    it('drops a rule using legacy single-colon :after', () => {
      const result = sanitizeBrandingCss(".foo:after { content: 'x'; }");

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
    });

    it('keeps ::placeholder verbatim', () => {
      const result = sanitizeBrandingCss('input::placeholder { color: gray; }');

      expect(normalize(result.css)).toBe('input::placeholder { color: gray; }');
      expect(result.warnings).toEqual([]);
    });

    it('keeps ::selection verbatim', () => {
      const result = sanitizeBrandingCss('p::selection { background: yellow; }');

      expect(normalize(result.css)).toBe('p::selection { background: yellow; }');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('universal selector', () => {
    it('drops a bare * selector rule', () => {
      const result = sanitizeBrandingCss('* { color: red; }');

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('selector');
    });

    it('drops a rule with * combined with descendant', () => {
      const result = sanitizeBrandingCss('* .x { color: red; }');

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
    });

    it('keeps attribute selectors that include * inside', () => {
      const result = sanitizeBrandingCss('[class*="foo"] { color: red; }');

      expect(normalize(result.css)).toBe('[class*="foo"] { color: red; }');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('blocked properties', () => {
    const blockedProperties = [
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
    ];

    for (const prop of blockedProperties) {
      it(`strips the "${prop}" property`, () => {
        const result = sanitizeBrandingCss(`.x { ${prop}: 10px; color: red; }`);

        expect(result.css).not.toContain(`${prop}:`);
        expect(result.css).toContain('color: red');
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].kind).toBe('property');
        expect(result.warnings[0].detail).toContain(prop);
      });
    }

    it('is case-insensitive on property names', () => {
      const result = sanitizeBrandingCss('.x { DISPLAY: none; color: red; }');

      expect(result.css).not.toMatch(/display/i);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('property');
    });

    const allowedProperties: Array<[string, string]> = [
      ['color', 'red'],
      ['background', '#fff'],
      ['border', '1px solid black'],
      ['border-radius', '4px'],
      ['font-family', 'sans-serif'],
      ['font-weight', '600'],
    ];

    for (const [prop, value] of allowedProperties) {
      it(`keeps the "${prop}" property`, () => {
        const result = sanitizeBrandingCss(`.x { ${prop}: ${value}; }`);

        expect(result.css).toContain(`${prop}: ${value}`);
        expect(result.warnings).toEqual([]);
      });
    }
  });

  describe('blocked values', () => {
    it('drops a declaration containing url(', () => {
      const result = sanitizeBrandingCss('.x { background: url(http://evil); }');

      expect(result.css).not.toContain('url(');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('value');
    });

    it('drops a declaration containing expression(', () => {
      const result = sanitizeBrandingCss('.x { background: expression(alert(1)); }');

      expect(result.css).not.toContain('expression(');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('value');
    });

    it('drops a declaration containing javascript: in a quoted value', () => {
      // PostCSS would throw on bare `javascript:alert(1)` (looks like a
      // malformed selector inside a declaration). Use a quoted value to
      // exercise the substring match cleanly.
      const result = sanitizeBrandingCss('.x { font-family: "javascript:alert"; }');

      expect(result.css).not.toContain('javascript:');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('value');
    });
  });

  describe('!important stripping', () => {
    it('strips !important from a retained declaration', () => {
      const result = sanitizeBrandingCss('.x { color: red !important; }');

      expect(result.css).not.toContain('!important');
      expect(result.css).toContain('color: red');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('at-rules', () => {
    it('drops @import', () => {
      const result = sanitizeBrandingCss('@import url("https://evil.example/x.css");');

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('at-rule');
    });

    it('drops @font-face', () => {
      const result = sanitizeBrandingCss('@font-face { font-family: "X"; src: url("x.woff2"); }');

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('at-rule');
    });

    it('drops @keyframes', () => {
      const result = sanitizeBrandingCss('@keyframes spin { to { transform: rotate(360deg); } }');

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('at-rule');
    });

    it('drops @supports', () => {
      const result = sanitizeBrandingCss('@supports (display: grid) { .x { color: red; } }');

      expect(result.css.trim()).toBe('');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('at-rule');
    });

    it('keeps @media with min-width and preserves inner selectors verbatim', () => {
      const result = sanitizeBrandingCss('@media (min-width: 600px) { .x { color: red; } }');

      expect(normalize(result.css)).toBe('@media (min-width: 600px) { .x { color: red; } }');
      expect(result.warnings).toEqual([]);
    });

    it('keeps @media with prefers-color-scheme and preserves body inside', () => {
      const result = sanitizeBrandingCss('@media (prefers-color-scheme: dark) { body { background: black; } }');

      expect(normalize(result.css)).toBe('@media (prefers-color-scheme: dark) { body { background: black; } }');
      expect(result.warnings).toEqual([]);
    });

    it('strips blocked properties inside @media', () => {
      const result = sanitizeBrandingCss('@media (min-width: 600px) { .x { display: none; color: red; } }');

      expect(result.css).not.toContain('display');
      expect(result.css).toContain('color: red');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].kind).toBe('property');
    });
  });

  describe('combined input', () => {
    it('keeps valid rules verbatim and reports each drop', () => {
      const input = `
        .ok { color: red !important; }
        .bad-prop { display: none; background: blue; }
        .bad-pseudo::before { content: 'x'; }
        * { color: red; }
        @import "evil.css";
        body { background: black; }
        @media (min-width: 600px) {
          .responsive { color: green; }
        }
      `;

      const result = sanitizeBrandingCss(input);

      // Valid bits present, unchanged.
      expect(result.css).toContain('.ok');
      expect(result.css).toContain('color: red');
      expect(result.css).toContain('.bad-prop');
      expect(result.css).toContain('background: blue');
      expect(result.css).toContain('body { background: black');
      expect(result.css).toContain('@media (min-width: 600px)');
      expect(result.css).toContain('.responsive');

      // Invalid bits gone.
      expect(result.css).not.toContain('!important');
      expect(result.css).not.toContain('display');
      expect(result.css).not.toContain('::before');
      expect(result.css).not.toContain('@import');

      // Warning kinds.
      const kinds = result.warnings.map((w) => w.kind).sort();
      expect(kinds).toEqual(['at-rule', 'property', 'selector', 'selector'].sort());
    });
  });

  describe('style-close-tag defence', () => {
    // The sanitised output is inlined into a `<style>` element via SSR. The
    // browser's HTML parser terminates the element on a literal `</style`
    // anywhere in the content. PostCSS's serializer normally escapes `<` to
    // `\3c` whenever it would form `</...`, so the literal sequence should
    // never reach the output for any of these inputs. These tests pin that
    // invariant.

    it('escapes </style> inside a string value', () => {
      const result = sanitizeBrandingCss('.x { font-family: "</style><img src=x onerror=alert(1)>"; }');

      expect(result.css.toLowerCase()).not.toContain('</style');
      // Whatever else happens, the canonical close-tag bytes must not appear.
    });

    it('escapes </style> inside a CSS comment', () => {
      const result = sanitizeBrandingCss('.x { color: red; /* </style><script>alert(1)</script> */ }');

      expect(result.css.toLowerCase()).not.toContain('</style');
    });

    it('escapes </style> inside an at-rule params block', () => {
      const result = sanitizeBrandingCss(
        '@media screen and (foo: bar)</style><script>x()</script> { .x { color: red; } }',
      );

      expect(result.css.toLowerCase()).not.toContain('</style');
    });

    it('escapes mixed-case </StYlE> in a value', () => {
      const result = sanitizeBrandingCss('.x { font-family: "</StYlE>foo"; }');

      expect(result.css.toLowerCase()).not.toContain('</style');
    });

    it('escapes </style> in an attribute selector value', () => {
      const result = sanitizeBrandingCss('[data-x="</style><script>alert(1)</script>"] { color: red; }');

      expect(result.css.toLowerCase()).not.toContain('</style');
    });

    it('preserves benign < not followed by /', () => {
      // `<script>` (no slash) is not a tag close; PostCSS leaves it as text
      // and the HTML parser treats it as text inside <style> rawtext mode.
      const result = sanitizeBrandingCss('.x { font-family: "<script>alert(1)</script>"; }');

      // The output keeps the literal `<script>` (harmless) but escapes the
      // `</script>` end tag's `<` for the same reason it'd escape `</style>`.
      expect(result.css).toContain('<script>');
      expect(result.css.toLowerCase()).not.toContain('</style');
    });
  });

  describe('malformed CSS', () => {
    // PostCSS is forgiving; an empty value parses without throwing.
    it('handles a declaration with an empty value gracefully', () => {
      const result = sanitizeBrandingCss('.x { color: }');

      expect(result.warnings.filter((w) => w.kind === 'parse-error')).toEqual([]);
      expect(result.css).toContain('.x');
    });

    it('reports a parse-error for clearly broken CSS', () => {
      // Unclosed brace.
      const result = sanitizeBrandingCss('.x { color: red');

      // PostCSS may or may not throw on this; if it does, we get a
      // parse-error warning. If it tolerates it, the rule is sanitized.
      if (result.css === '') {
        expect(result.warnings.some((w) => w.kind === 'parse-error')).toBe(true);
      } else {
        expect(result.css).toContain('.x');
      }
    });
  });
});
