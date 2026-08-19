import { describe, expect, it } from 'vitest';

import { deriveGuidedSigningStep, isGuidedSigningEligible } from './guided-signing';

describe('deriveGuidedSigningStep', () => {
  it('asks for the signature first when a signature field exists and none is stored', () => {
    expect(
      deriveGuidedSigningStep({
        hasSignatureField: true,
        hasSignature: false,
        requiredFieldCount: 8,
        pendingFieldCount: 8,
      }),
    ).toEqual({ kind: 'draw' });
  });

  it('counts the next field 1-based once a signature exists', () => {
    expect(
      deriveGuidedSigningStep({
        hasSignatureField: true,
        hasSignature: true,
        requiredFieldCount: 8,
        pendingFieldCount: 8,
      }),
    ).toEqual({ kind: 'field', index: 1, total: 8 });

    expect(
      deriveGuidedSigningStep({
        hasSignatureField: true,
        hasSignature: true,
        requiredFieldCount: 8,
        pendingFieldCount: 3,
      }),
    ).toEqual({ kind: 'field', index: 6, total: 8 });
  });

  it('moves to complete when nothing is pending', () => {
    expect(
      deriveGuidedSigningStep({
        hasSignatureField: true,
        hasSignature: true,
        requiredFieldCount: 8,
        pendingFieldCount: 0,
      }),
    ).toEqual({ kind: 'complete', total: 8 });
  });

  it('skips the draw step for documents without signature fields', () => {
    expect(
      deriveGuidedSigningStep({
        hasSignatureField: false,
        hasSignature: false,
        requiredFieldCount: 2,
        pendingFieldCount: 2,
      }),
    ).toEqual({ kind: 'field', index: 1, total: 2 });
  });

  it('never produces an index beyond the total', () => {
    expect(
      deriveGuidedSigningStep({
        hasSignatureField: false,
        hasSignature: false,
        requiredFieldCount: 2,
        pendingFieldCount: 5,
      }),
    ).toEqual({ kind: 'field', index: 1, total: 2 });
  });
});

describe('isGuidedSigningEligible', () => {
  const eligible = {
    featureFlag: 'true',
    isAssistantMode: false,
    isNameLocked: true,
    isEmailLocked: true,
  };

  it('is on only with the flag set to "true" and a fully locked signer', () => {
    expect(isGuidedSigningEligible(eligible)).toBe(true);
  });

  it('falls back to upstream when the flag is unset or anything but "true"', () => {
    expect(isGuidedSigningEligible({ ...eligible, featureFlag: undefined })).toBe(false);
    expect(isGuidedSigningEligible({ ...eligible, featureFlag: '1' })).toBe(false);
    expect(isGuidedSigningEligible({ ...eligible, featureFlag: 'false' })).toBe(false);
  });

  it('falls back to upstream for assistants and editable name/e-mail', () => {
    expect(isGuidedSigningEligible({ ...eligible, isAssistantMode: true })).toBe(false);
    expect(isGuidedSigningEligible({ ...eligible, isNameLocked: false })).toBe(false);
    expect(isGuidedSigningEligible({ ...eligible, isEmailLocked: false })).toBe(false);
  });
});
