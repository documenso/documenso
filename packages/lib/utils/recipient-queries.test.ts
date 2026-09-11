import { RecipientRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  getAssistableRecipientsWhereInput,
  getLaterSigningStepRecipientsWhereInput,
  getRecipientFieldsWhereInput,
} from './recipient-queries';

describe('getLaterSigningStepRecipientsWhereInput', () => {
  it('scopes ordered assistants to their own envelope', () => {
    const where = getLaterSigningStepRecipientsWhereInput({ signingOrder: 2, envelopeId: 'envelope_1' });

    // Envelope scoping must be baked into the predicate itself — the
    // signingOrder arms alone would match recipients across every envelope.
    expect(where).toEqual({
      envelopeId: 'envelope_1',
      OR: [{ signingOrder: { gt: 2 } }, { signingOrder: null }],
    });
  });

  // A non-finite order bypassing the types would emit `{ gt: undefined }` /
  // `{ gt: NaN }`, which Prisma silently drops — inverting the predicate into
  // match-everything. The runtime backstop must throw instead of failing open.
  it('throws when a non-numeric signing order bypasses the types', () => {
    expect(() =>
      getLaterSigningStepRecipientsWhereInput({
        signingOrder: undefined as unknown as number,
        envelopeId: 'envelope_1',
      }),
    ).toThrow();

    expect(() =>
      getLaterSigningStepRecipientsWhereInput({
        signingOrder: NaN,
        envelopeId: 'envelope_1',
      }),
    ).toThrow();
  });
});

describe('getAssistableRecipientsWhereInput', () => {
  it('scopes to the envelope and matches self plus strictly later steps', () => {
    const where = getAssistableRecipientsWhereInput({ id: 10, signingOrder: 2, envelopeId: 'envelope_1' });

    expect(where).toEqual({
      envelopeId: 'envelope_1',
      OR: [
        { id: 10 },
        {
          envelopeId: 'envelope_1',
          OR: [{ signingOrder: { gt: 2 } }, { signingOrder: null }],
        },
      ],
    });
  });

  it('matches only self for a null-order assistant', () => {
    // A null-order assistant sits in the last step: nobody comes after them,
    // so no later-step predicate exists at all — just the self match.
    expect(getAssistableRecipientsWhereInput({ id: 10, signingOrder: null, envelopeId: 'envelope_1' })).toEqual({
      envelopeId: 'envelope_1',
      id: 10,
    });
  });

  // `{ gt: undefined }` is silently dropped by Prisma, turning a comparison
  // arm into match-everything — non-numeric orders must fail closed to self.
  it('matches only self when the signing order is undefined (fail closed)', () => {
    expect(
      getAssistableRecipientsWhereInput({
        id: 10,
        signingOrder: undefined as unknown as number | null,
        envelopeId: 'envelope_1',
      }),
    ).toEqual({
      envelopeId: 'envelope_1',
      id: 10,
    });
  });
});

describe('getRecipientFieldsWhereInput', () => {
  const assistant = {
    id: 10,
    role: RecipientRole.ASSISTANT,
    signingOrder: 2,
    envelopeId: 'envelope_1',
  };

  it('restricts non-assistants to their own recipient row', () => {
    const where = getRecipientFieldsWhereInput({
      recipient: { ...assistant, role: RecipientRole.SIGNER },
      allowAssistantAccessToOtherRecipients: true,
    });

    expect(where).toEqual({ id: 10 });
  });

  it('restricts assistants to their own recipient row when access is not allowed', () => {
    const where = getRecipientFieldsWhereInput({
      recipient: assistant,
      allowAssistantAccessToOtherRecipients: false,
    });

    expect(where).toEqual({ id: 10 });
  });

  it('scopes assistant access to unsigned recipients in the same envelope', () => {
    const where = getRecipientFieldsWhereInput({
      recipient: assistant,
      allowAssistantAccessToOtherRecipients: true,
    });

    expect(where).toEqual({
      signingStatus: { not: 'SIGNED' },
      envelopeId: 'envelope_1',
      AND: [
        {
          envelopeId: 'envelope_1',
          OR: [
            { id: 10 },
            {
              envelopeId: 'envelope_1',
              OR: [{ signingOrder: { gt: 2 } }, { signingOrder: null }],
            },
          ],
        },
      ],
    });
  });

  it('collapses a null-order assistant to their own unsigned fields', () => {
    const where = getRecipientFieldsWhereInput({
      recipient: { ...assistant, signingOrder: null },
      allowAssistantAccessToOtherRecipients: true,
    });

    expect(where).toEqual({
      signingStatus: { not: 'SIGNED' },
      envelopeId: 'envelope_1',
      AND: [{ envelopeId: 'envelope_1', id: 10 }],
    });
  });
});
