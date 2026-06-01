import { describe, expect, it } from 'vitest';

import { assertSignatureModeAllowed, isSignatureModeAllowed } from './signature-mode';

describe('isSignatureModeAllowed', () => {
  describe('typed signatures', () => {
    it('is allowed when typedSignatureEnabled is true', () => {
      expect(isSignatureModeAllowed('typed', { typedSignatureEnabled: true })).toBe(true);
    });

    it('is allowed when typedSignatureEnabled is unset (default-on)', () => {
      expect(isSignatureModeAllowed('typed', {})).toBe(true);
    });

    it('is allowed when typedSignatureEnabled is null (default-on)', () => {
      expect(isSignatureModeAllowed('typed', { typedSignatureEnabled: null })).toBe(true);
    });

    it('is rejected only when typedSignatureEnabled is explicitly false', () => {
      expect(isSignatureModeAllowed('typed', { typedSignatureEnabled: false })).toBe(false);
    });
  });

  describe('image signatures (drawn or uploaded)', () => {
    it('is allowed when both drawSignatureEnabled and uploadSignatureEnabled are unset', () => {
      expect(isSignatureModeAllowed('image', {})).toBe(true);
    });

    it('is allowed when only drawSignatureEnabled is true', () => {
      expect(
        isSignatureModeAllowed('image', {
          drawSignatureEnabled: true,
          uploadSignatureEnabled: false,
        }),
      ).toBe(true);
    });

    it('is allowed when only uploadSignatureEnabled is true', () => {
      expect(
        isSignatureModeAllowed('image', {
          drawSignatureEnabled: false,
          uploadSignatureEnabled: true,
        }),
      ).toBe(true);
    });

    it('is rejected only when BOTH drawSignatureEnabled and uploadSignatureEnabled are false', () => {
      expect(
        isSignatureModeAllowed('image', {
          drawSignatureEnabled: false,
          uploadSignatureEnabled: false,
        }),
      ).toBe(false);
    });

    it('treats null the same as unset (default-on)', () => {
      expect(
        isSignatureModeAllowed('image', {
          drawSignatureEnabled: null,
          uploadSignatureEnabled: null,
        }),
      ).toBe(true);
    });
  });
});

describe('assertSignatureModeAllowed', () => {
  it('does not throw when mode is allowed', () => {
    expect(() => assertSignatureModeAllowed('typed', { typedSignatureEnabled: true })).not.toThrow();
    expect(() =>
      assertSignatureModeAllowed('image', { drawSignatureEnabled: true, uploadSignatureEnabled: false }),
    ).not.toThrow();
  });

  it('throws with the typed-specific message when typed is disabled', () => {
    expect(() => assertSignatureModeAllowed('typed', { typedSignatureEnabled: false })).toThrow(
      /typed signatures are not allowed/i,
    );
  });

  it('throws with the image-specific message when both drawn and uploaded are disabled', () => {
    expect(() =>
      assertSignatureModeAllowed('image', {
        drawSignatureEnabled: false,
        uploadSignatureEnabled: false,
      }),
    ).toThrow(/drawn or uploaded signatures are not allowed/i);
  });
});
