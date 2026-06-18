import { describe, expect, it } from 'vitest';

import { getSignatureFontFamily } from './pdf';

describe('getSignatureFontFamily', () => {
  // The two literal family strings the helper picks between. Asserted by
  // shape (starts-with / contains the right family) rather than by full
  // equality so the chain can grow without breaking tests.
  const expectCaveat = (family: string) => expect(family).toBe('Caveat');
  const expectNotoChain = (family: string) => {
    expect(family).toContain('Noto Sans');
    expect(family).toContain('Noto Sans Chinese');
    expect(family).toContain('Noto Sans Japanese');
    expect(family).toContain('Noto Sans Korean');
    expect(family).toContain('sans-serif');
    expect(family).not.toContain('Caveat');
  };

  it('returns Caveat for Latin-only text', () => {
    expectCaveat(getSignatureFontFamily('John Doe'));
    expectCaveat(getSignatureFontFamily(''));
  });

  it('returns Caveat for Latin-extended text (accents, umlauts, eszett)', () => {
    // Common Western European names that must stay in handwriting style.
    expectCaveat(getSignatureFontFamily('François'));
    expectCaveat(getSignatureFontFamily('Müller'));
    expectCaveat(getSignatureFontFamily('Søren'));
  });

  it('returns Caveat for Cyrillic text (Caveat ships Cyrillic glyphs)', () => {
    expectCaveat(getSignatureFontFamily('Иванов'));
    expectCaveat(getSignatureFontFamily('Кириллица'));
  });

  it('returns the Noto chain for any non-Caveat script', () => {
    expectNotoChain(getSignatureFontFamily('Ελληνικά')); // Greek
    expectNotoChain(getSignatureFontFamily('عربي')); // Arabic
    expectNotoChain(getSignatureFontFamily('עברית')); // Hebrew
    expectNotoChain(getSignatureFontFamily('도큐멘소')); // Korean
    expectNotoChain(getSignatureFontFamily('中文签名')); // Chinese
    expectNotoChain(getSignatureFontFamily('こんにちは')); // Japanese kana
  });

  it('returns the Noto chain for any mixed-script input that includes a non-Caveat script', () => {
    // Even one non-Caveat character bumps the whole signature to Noto -
    // deliberately all-or-nothing so we never split a signature between
    // handwriting and sans-serif.
    expectNotoChain(getSignatureFontFamily('Hello 안녕'));
    expectNotoChain(getSignatureFontFamily('Иван Ωmega'));
  });

  it('returns the Noto chain for scripts not explicitly listed in the chain', () => {
    // Regression guard: the chain handles Greek/Hebrew/Arabic/etc. via
    // "Noto Sans" (Latin Noto, which actually covers many scripts). Less
    // common scripts that fall outside Noto Sans's coverage still get
    // routed away from Caveat by this helper - they end up rendered as
    // sans-serif fallback rather than tofu'ing under Caveat.
    expectNotoChain(getSignatureFontFamily('ሰላም')); // Ethiopic
    expectNotoChain(getSignatureFontFamily('សួស្ដី')); // Khmer
    expectNotoChain(getSignatureFontFamily('ᠮᠣᠩᠭᠣᠯ')); // Mongolian
  });
});
