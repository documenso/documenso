import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, SigningStatus } from '@prisma/client';

/**
 * Rejecting a document only marks the recipient; the envelope is moved to
 * REJECTED later, asynchronously, by the seal job. Until that lands the
 * envelope is still PENDING, so another recipient can complete and the
 * advancement logic runs with a REJECTED recipient in the list.
 *
 * That recipient must never be treated as the next signing group — doing so
 * re-marks them as sent and emails them a signing request for a document they
 * declined. Nor may the flow advance PAST them: the turn check treats a
 * rejection as blocking, so a recipient in a later step would receive a
 * signing request whose link redirects to /waiting and whose completion is
 * refused. (For rejected TSP envelopes the seal job always throws, so this
 * state is permanent rather than a narrow race.)
 */

const expectSigningRequestJobCount = async (recipientId: number, expected: number) => {
  const jobs = await prisma.backgroundJob.findMany({
    where: {
      jobId: 'send.signing.requested.email',
      payload: {
        path: ['recipientId'],
        equals: recipientId,
      },
    },
  });

  expect(jobs.length).toBe(expected);
};

test('[REJECTED_ADVANCEMENT]: no step is activated past a rejected recipient', async () => {
  const { user, team } = await seedUser();
  const { user: firstSigner } = await seedUser();
  const { user: rejectedSigner } = await seedUser();
  const { user: laterSigner } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [firstSigner, rejectedSigner, laterSigner],
    recipientsCreateOptions: [
      { signingOrder: 1, signingStatus: SigningStatus.NOT_SIGNED },
      { signingOrder: 2, signingStatus: SigningStatus.REJECTED },
      { signingOrder: 3, signingStatus: SigningStatus.NOT_SIGNED },
    ],
    // No fields, so completion is not blocked by unsigned required fields.
    fields: [],
    updateDocumentOptions: {
      documentMeta: {
        upsert: {
          create: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
          update: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
        },
      },
    },
  });

  const first = recipients.find((recipient) => recipient.email === firstSigner.email);
  const rejected = recipients.find((recipient) => recipient.email === rejectedSigner.email);
  const later = recipients.find((recipient) => recipient.email === laterSigner.email);

  if (!first || !rejected || !later) {
    throw new Error('Seeded recipients not found');
  }

  // The seed never sets sentAt, so it is a clean signal for "was activated".
  expect(rejected.sentAt).toBeNull();
  expect(later.sentAt).toBeNull();

  await completeDocumentWithToken({
    token: first.token,
    id: { type: 'envelopeId', id: first.envelopeId },
  });

  const rejectedAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: rejected.id } });
  const laterAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: later.id } });

  // The rejected recipient is left alone entirely.
  expect(rejectedAfter.sentAt).toBeNull();
  expect(rejectedAfter.signingStatus).toBe(SigningStatus.REJECTED);
  await expectSigningRequestJobCount(rejected.id, 0);

  // The later step is NOT activated either: the rejection blocks the flow
  // (the turn check would refuse their completion), and the envelope is
  // heading to REJECTED via the seal job. Emailing them would invite a
  // signing session that can only dead-end at /waiting.
  expect(laterAfter.sentAt).toBeNull();
  await expectSigningRequestJobCount(later.id, 0);
});
