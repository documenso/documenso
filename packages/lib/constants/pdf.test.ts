import { describe, expect, it } from 'vitest';

import { getSignatureFontFamily } from './pdf';

describe('getSignatureFontFamily', () => {
  // Shape-assert the Noto chain so the chain can grow without rewriting tests.
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

  it('returns the Noto chain for mixed-script input containing any non-Caveat script', () => {
    expectNotoChain(getSignatureFontFamily('Hello 안녕'));
    expectNotoChain(getSignatureFontFamily('Иван Ωmega'));
  });

  it('returns the Noto chain for scripts not explicitly listed in the chain', () => {
    // Negative-match regex guarantees these don't silently fall through to
    // Caveat (which would tofu). They render via sans-serif at the end of
    // the chain.
    expectNotoChain(getSignatureFontFamily('ሰላም')); // Ethiopic
    expectNotoChain(getSignatureFontFamily('សួស្ដី')); // Khmer
    expectNotoChain(getSignatureFontFamily('ᠮᠣᠩᠭᠣᠯ')); // Mongolian
  });
});
