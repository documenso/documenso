import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { getIsRecipientsTurnToSign } from '@documenso/lib/server-only/recipient/get-is-recipient-turn';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, SendStatus } from '@prisma/client';

/**
 * Sequential documents created before automatic numbering hold recipients
 * with a NULL `signingOrder`, processed one at a time in id order.
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

const seedLegacySequentialDocument = async (options: {
  signingOrders: Array<number | null>;
  signatureLevel?: string;
}) => {
  const { user, team } = await seedUser();
  const signers = await Promise.all(options.signingOrders.map(async () => (await seedUser()).user));

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: signers,
    recipientsCreateOptions: options.signingOrders.map((signingOrder, index) => ({
      signingOrder,
      sendStatus: index === 0 ? SendStatus.SENT : SendStatus.NOT_SENT,
    })),
    fields: [],
    updateDocumentOptions: {
      signatureLevel: options.signatureLevel,
      documentMeta: {
        upsert: {
          create: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
          update: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
        },
      },
    },
  });

  const byId = [...recipients].sort((a, b) => a.id - b.id);

  return { first: byId[0], second: byId[1], third: byId[2] };
};

test('[LEGACY_UNORDERED]: unordered recipients take turns by id and are invited one at a time', async () => {
  const { first, second, third } = await seedLegacySequentialDocument({ signingOrders: [null, null, null] });

  expect(await getIsRecipientsTurnToSign({ token: first.token })).toBe(true);
  expect(await getIsRecipientsTurnToSign({ token: second.token })).toBe(false);
  expect(await getIsRecipientsTurnToSign({ token: third.token })).toBe(false);

  await completeDocumentWithToken({
    token: first.token,
    id: { type: 'envelopeId', id: first.envelopeId },
  });

  const secondAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: second.id } });
  const thirdAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: third.id } });

  expect(secondAfter.sendStatus).toBe(SendStatus.SENT);
  await expectSigningRequestJobCount(second.id, 1);

  expect(thirdAfter.sendStatus).toBe(SendStatus.NOT_SENT);
  await expectSigningRequestJobCount(third.id, 0);

  expect(await getIsRecipientsTurnToSign({ token: second.token })).toBe(true);
  expect(await getIsRecipientsTurnToSign({ token: third.token })).toBe(false);
});

test('[LEGACY_UNORDERED]: numbered recipients sign before unordered ones', async () => {
  const { first, second, third } = await seedLegacySequentialDocument({ signingOrders: [null, null, 1] });

  expect(await getIsRecipientsTurnToSign({ token: third.token })).toBe(true);
  expect(await getIsRecipientsTurnToSign({ token: first.token })).toBe(false);

  await completeDocumentWithToken({
    token: third.token,
    id: { type: 'envelopeId', id: third.envelopeId },
  });

  await expectSigningRequestJobCount(first.id, 1);
  await expectSigningRequestJobCount(second.id, 0);

  expect(await getIsRecipientsTurnToSign({ token: first.token })).toBe(true);
  expect(await getIsRecipientsTurnToSign({ token: second.token })).toBe(false);
});

test('[LEGACY_UNORDERED]: an AES envelope sequences a legacy duplicate order one recipient at a time', async () => {
  const { first, second } = await seedLegacySequentialDocument({
    signingOrders: [1, 1],
    signatureLevel: 'AES',
  });

  expect(await getIsRecipientsTurnToSign({ token: first.token })).toBe(true);
  expect(await getIsRecipientsTurnToSign({ token: second.token })).toBe(false);

  await expect(
    completeDocumentWithToken({
      token: second.token,
      id: { type: 'envelopeId', id: second.envelopeId },
    }),
  ).rejects.toThrow();

  await completeDocumentWithToken({
    token: first.token,
    id: { type: 'envelopeId', id: first.envelopeId },
  });

  const secondAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: second.id } });

  expect(secondAfter.sendStatus).toBe(SendStatus.SENT);
  await expectSigningRequestJobCount(second.id, 1);
  expect(await getIsRecipientsTurnToSign({ token: second.token })).toBe(true);
});
