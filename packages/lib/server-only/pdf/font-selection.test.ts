import { describe, expect, it } from 'vitest';

import { getSignatureFontKey } from './font-selection';

describe('getSignatureFontKey', () => {
  it('should return caveat for Latin-only text', () => {
    expect(getSignatureFontKey('John Doe')).toBe('caveat');
    expect(getSignatureFontKey('Jane Smith')).toBe('caveat');
    expect(getSignatureFontKey('')).toBe('caveat');
  });

  it('should return noto-sans for Greek characters', () => {
    expect(getSignatureFontKey('Ελληνικά')).toBe('noto-sans');
    expect(getSignatureFontKey('αβγδ')).toBe('noto-sans');
    expect(getSignatureFontKey('Ωmega')).toBe('noto-sans');
  });

  it('should return noto-sans for Cyrillic characters', () => {
    expect(getSignatureFontKey('Кириллица')).toBe('noto-sans');
    expect(getSignatureFontKey('Иванов')).toBe('noto-sans');
  });

  it('should return noto-sans for Arabic characters', () => {
    expect(getSignatureFontKey('عربي')).toBe('noto-sans');
  });

  it('should return noto-sans-korean for Korean characters', () => {
    expect(getSignatureFontKey('도큐멘소')).toBe('noto-sans-korean');
    expect(getSignatureFontKey('한글')).toBe('noto-sans-korean');
  });

  it('should return noto-sans-japanese for Japanese characters', () => {
    expect(getSignatureFontKey('こんにちは')).toBe('noto-sans-japanese');
    expect(getSignatureFontKey('カタカナ')).toBe('noto-sans-japanese');
  });

  it('should return noto-sans-chinese for Chinese characters', () => {
    expect(getSignatureFontKey('中文签名')).toBe('noto-sans-chinese');
    expect(getSignatureFontKey('签署')).toBe('noto-sans-chinese');
  });

  it('should prioritize Korean over CJK for mixed text', () => {
    expect(getSignatureFontKey('한글中文')).toBe('noto-sans-korean');
  });

  it('should prioritize Japanese over CJK for mixed text', () => {
    expect(getSignatureFontKey('ひらがな中文')).toBe('noto-sans-japanese');
  });

  it('should handle Latin + non-Latin mixed text', () => {
    expect(getSignatureFontKey('Hello 안녕')).toBe('noto-sans-korean');
    expect(getSignatureFontKey('Sign Ελληνικά')).toBe('noto-sans');
    expect(getSignatureFontKey('Name 中文')).toBe('noto-sans-chinese');
  });
});
