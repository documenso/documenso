import { RecipientRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { getDocumentCompletedEmailRecipients } from './document-completed-email-recipients';

const signer = { email: 'signer@example.com', role: RecipientRole.SIGNER };
const cc = { email: 'cc@example.com', role: RecipientRole.CC };
const invalidCc = { email: 'not-an-email', role: RecipientRole.CC };

describe('getDocumentCompletedEmailRecipients', () => {
  it('returns all deliverable recipients when document completed emails are enabled', () => {
    expect(
      getDocumentCompletedEmailRecipients([signer, cc], {
        documentCompleted: true,
        ownerDocumentCompleted: true,
      }),
    ).toEqual([signer, cc]);
  });

  it('returns only CC recipients when recipient emails are disabled but owner emails are enabled', () => {
    expect(
      getDocumentCompletedEmailRecipients([signer, cc], {
        documentCompleted: false,
        ownerDocumentCompleted: true,
      }),
    ).toEqual([cc]);
  });

  it('returns no recipients when both completion email settings are disabled', () => {
    expect(
      getDocumentCompletedEmailRecipients([signer, cc], {
        documentCompleted: false,
        ownerDocumentCompleted: false,
      }),
    ).toEqual([]);
  });

  it('filters out recipients with invalid email addresses', () => {
    expect(
      getDocumentCompletedEmailRecipients([invalidCc, cc], {
        documentCompleted: true,
        ownerDocumentCompleted: true,
      }),
    ).toEqual([cc]);
  });
});
