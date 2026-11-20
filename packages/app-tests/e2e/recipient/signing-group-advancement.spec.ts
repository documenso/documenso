import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, SendStatus } from '@prisma/client';

/**
 * A signing group is a set of recipients sharing one `signingOrder`. Two
 * server-side guarantees define the feature, and neither was asserted anywhere:
 *
 *   1. When a step unlocks, *every* member of that step is activated together.
 *   2. The next step stays locked until *every* member of the current step has
 *      signed — one member finishing must not advance the flow.
 *
 * These drive `completeDocumentWithToken` directly rather than the browser, so
 * the side effects (signing-request jobs, and the `sendStatus` and `sentAt` they
 * set) can be asserted precisely, and without the cost of four UI signing flows.
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

// The signing email job marks the recipient as sent once it has run on the app server.
const expectRecipientToBeSent = async (recipientId: number) => {
  await expect
    .poll(
      async () => {
        const recipient = await prisma.recipient.findUniqueOrThrow({
          where: {
            id: recipientId,
          },
        });

        return {
          sendStatus: recipient.sendStatus,
          hasSentAt: recipient.sentAt !== null,
        };
      },
      { timeout: 15_000 },
    )
    .toEqual({
      sendStatus: SendStatus.SENT,
      hasSentAt: true,
    });
};

/**
 * Steps: 1 = `first`, 2 = `groupA` + `groupB` (the group), 3 = `last`.
 */
const seedGroupedDocument = async () => {
  const { user, team } = await seedUser();
  const { user: firstSigner } = await seedUser();
  const { user: groupASigner } = await seedUser();
  const { user: groupBSigner } = await seedUser();
  const { user: lastSigner } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [firstSigner, groupASigner, groupBSigner, lastSigner],
    recipientsCreateOptions: [
      { signingOrder: 1, sendStatus: SendStatus.SENT },
      // The seed marks every recipient SENT by default, but a real SEQUENTIAL
      // document leaves later steps NOT_SENT until their signing request is sent.
      // Without this, checking that a step becomes SENT would prove nothing.
      { signingOrder: 2, sendStatus: SendStatus.NOT_SENT },
      { signingOrder: 2, sendStatus: SendStatus.NOT_SENT },
      { signingOrder: 3, sendStatus: SendStatus.NOT_SENT },
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

  const findByEmail = (email: string) => {
    const recipient = recipients.find((item) => item.email === email);

    if (!recipient) {
      throw new Error(`Seeded recipient ${email} not found`);
    }

    return recipient;
  };

  return {
    first: findByEmail(firstSigner.email),
    groupA: findByEmail(groupASigner.email),
    groupB: findByEmail(groupBSigner.email),
    last: findByEmail(lastSigner.email),
  };
};

test('[SIGNING_GROUPS]: unlocking a step activates every member of that step, and only that step', async () => {
  const { first, groupA, groupB, last } = await seedGroupedDocument();

  await completeDocumentWithToken({
    token: first.token,
    id: { type: 'envelopeId', id: first.envelopeId },
  });

  // Both members of step 2 are activated together.
  await expectSigningRequestJobCount(groupA.id, 1);
  await expectRecipientToBeSent(groupA.id);

  await expectSigningRequestJobCount(groupB.id, 1);
  await expectRecipientToBeSent(groupB.id);

  // Step 3 is not pulled forward with them.
  const lastAfter = await prisma.recipient.findUniqueOrThrow({
    where: {
      id: last.id,
    },
  });

  expect(lastAfter.sendStatus).toBe(SendStatus.NOT_SENT);
  expect(lastAfter.sentAt).toBeNull();
  await expectSigningRequestJobCount(last.id, 0);
});

test('[SIGNING_GROUPS]: the next step stays locked until every member of the group has signed', async () => {
  const { first, groupA, groupB, last } = await seedGroupedDocument();

  await completeDocumentWithToken({
    token: first.token,
    id: { type: 'envelopeId', id: first.envelopeId },
  });

  // Only one of the two group members signs.
  await completeDocumentWithToken({
    token: groupA.token,
    id: { type: 'envelopeId', id: groupA.envelopeId },
  });

  const lastWhileGroupPending = await prisma.recipient.findUniqueOrThrow({
    where: {
      id: last.id,
    },
  });

  expect(lastWhileGroupPending.sendStatus).toBe(SendStatus.NOT_SENT);
  expect(lastWhileGroupPending.sentAt).toBeNull();
  await expectSigningRequestJobCount(last.id, 0);

  // The outstanding peer must not be re-notified by their peer's completion.
  await expectSigningRequestJobCount(groupB.id, 1);

  // The final member of the group signs; the flow advances.
  await completeDocumentWithToken({
    token: groupB.token,
    id: { type: 'envelopeId', id: groupB.envelopeId },
  });

  await expectSigningRequestJobCount(last.id, 1);
  await expectRecipientToBeSent(last.id);
});
