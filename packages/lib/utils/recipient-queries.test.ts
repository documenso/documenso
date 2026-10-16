import { RecipientRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { getLaterSigningStepRecipientsWhereInput, getRecipientFieldsWhereInput } from './recipient-queries';

describe('getLaterSigningStepRecipientsWhereInput', () => {
  it('follows a numbered assistant with higher numbers and every unordered recipient', () => {
    const where = getLaterSigningStepRecipientsWhereInput({ id: 10, signingOrder: 2, envelopeId: 'envelope_1' });

    expect(where).toEqual({
      envelopeId: 'envelope_1',
      OR: [{ signingOrder: { gt: 2 } }, { signingOrder: null }],
    });
  });

  it('follows an unordered assistant with later unordered recipients only', () => {
    const where = getLaterSigningStepRecipientsWhereInput({ id: 10, signingOrder: null, envelopeId: 'envelope_1' });

    expect(where).toEqual({
      envelopeId: 'envelope_1',
      signingOrder: null,
      id: { gt: 10 },
    });
  });

  // `{ gt: undefined }` / `{ gt: NaN }` is silently dropped by Prisma, which
  // would invert the predicate into match-everything. Fail closed instead.
  it('throws when a non-finite id or order bypasses the types', () => {
    expect(() =>
      getLaterSigningStepRecipientsWhereInput({
        id: undefined as unknown as number,
        signingOrder: null,
        envelopeId: 'envelope_1',
      }),
    ).toThrow();

    expect(() =>
      getLaterSigningStepRecipientsWhereInput({ id: 10, signingOrder: NaN, envelopeId: 'envelope_1' }),
    ).toThrow();
  });
});

describe('getRecipientFieldsWhereInput', () => {
  const assistant = {
    id: 10,
    role: RecipientRole.ASSISTANT,
    signingOrder: 2,
    envelopeId: 'envelope_1',
  };

  it('restricts non-assistants and disallowed assistants to their own recipient row', () => {
    expect(
      getRecipientFieldsWhereInput({
        recipient: { ...assistant, role: RecipientRole.SIGNER },
        allowAssistantAccessToOtherRecipients: true,
      }),
    ).toEqual({ id: 10 });

    expect(
      getRecipientFieldsWhereInput({
        recipient: assistant,
        allowAssistantAccessToOtherRecipients: false,
      }),
    ).toEqual({ id: 10 });
  });

  it('scopes assistant access to unsigned recipients positioned after them in the same envelope', () => {
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
});
