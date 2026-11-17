import { rejectDocumentWithToken } from '@documenso/lib/server-only/document/reject-document-with-token';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentStatus, SigningStatus } from '@prisma/client';

/**
 * These drive `rejectDocumentWithToken` directly rather than the browser, so
 * two rejections can be started at the same moment.
 */

test('[REJECT_DOCUMENT]: only one of two simultaneous rejections takes effect', async () => {
  const { user, team } = await seedUser();
  const { user: firstSigner } = await seedUser();
  const { user: secondSigner } = await seedUser();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [firstSigner, secondSigner],
    fields: [],
  });

  const outcomes = await Promise.allSettled(
    recipients.map(async (recipient) =>
      rejectDocumentWithToken({
        token: recipient.token,
        id: { type: 'envelopeId', id: document.id },
        reason: 'I do not agree',
      }),
    ),
  );

  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { recipients: true },
  });

  expect(envelope.status).toBe(DocumentStatus.REJECTED);
  expect(envelope.recipients.filter((recipient) => recipient.signingStatus === SigningStatus.REJECTED)).toHaveLength(1);
});
