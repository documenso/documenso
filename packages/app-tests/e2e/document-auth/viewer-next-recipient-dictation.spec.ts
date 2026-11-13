import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, RecipientRole, SendStatus, SigningStatus } from '@prisma/client';

/**
 * A viewer's completion dialog activates the next-signer validator from
 * `allowDictateNextSigner` alone, while the name/email inputs only render
 * when a dictatable next recipient exists. When dictation is enabled but the
 * next step is not dictatable (a group of two or more, or the viewer is
 * last), submission must still work — historically it failed Zod validation
 * on the hidden inputs and "Mark as Viewed" silently did nothing.
 */

const seedViewerDictationDocument = async (
  recipientsCreateOptions: {
    signingOrder: number;
    role?: RecipientRole;
    sendStatus?: SendStatus;
  }[],
) => {
  const { user, team } = await seedUser();

  const signers = await Promise.all(recipientsCreateOptions.map(async () => (await seedUser()).user));

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: signers,
    recipientsCreateOptions,
    // No fields, so completion is not blocked by unsigned required fields.
    fields: [],
    updateDocumentOptions: {
      documentMeta: {
        upsert: {
          create: {
            signingOrder: DocumentSigningOrder.SEQUENTIAL,
            allowDictateNextSigner: true,
          },
          update: {
            signingOrder: DocumentSigningOrder.SEQUENTIAL,
            allowDictateNextSigner: true,
          },
        },
      },
    },
  });

  return { document, recipients };
};

test('[NEXT_RECIPIENT_DICTATION]: viewer can mark as viewed when the next step is a group', async ({ page }) => {
  const { document, recipients } = await seedViewerDictationDocument([
    { signingOrder: 1, role: RecipientRole.VIEWER },
    // The next step is a group of two, so there is no single dictatable next
    // recipient — the dialog must not demand one.
    { signingOrder: 2, sendStatus: SendStatus.NOT_SENT },
    { signingOrder: 2, sendStatus: SendStatus.NOT_SENT },
  ]);

  const [viewer, groupA, groupB] = recipients;

  const signUrl = `/sign/${viewer.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'View Document' })).toBeVisible();

  const dialog = page.getByRole('dialog');

  // Retry the click: it can land before hydration attaches the handler.
  await expect(async () => {
    await page.getByRole('button', { name: 'Mark as viewed', exact: true }).click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass();

  // No dictation inputs: a group cannot be dictated over.
  await expect(dialog.getByText('Next Recipient Name')).not.toBeVisible();

  await dialog.getByRole('button', { name: 'Mark as Viewed', exact: true }).click();

  await page.waitForURL(`${signUrl}/complete`);

  // The viewer completed and the group's step unlocked.
  await expect
    .poll(async () => {
      const updatedRecipients = await prisma.recipient.findMany({
        where: { envelopeId: document.id },
        orderBy: { id: 'asc' },
      });

      return updatedRecipients.map((recipient) => [recipient.signingStatus, recipient.sendStatus]);
    })
    .toEqual([
      [SigningStatus.SIGNED, SendStatus.SENT],
      [SigningStatus.NOT_SIGNED, SendStatus.SENT],
      [SigningStatus.NOT_SIGNED, SendStatus.SENT],
    ]);

  // Nobody was renamed: no next-signer values existed to apply.
  const groupAAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: groupA.id } });
  const groupBAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: groupB.id } });

  expect(groupAAfter.email).toBe(groupA.email);
  expect(groupBAfter.email).toBe(groupB.email);
});

test('[NEXT_RECIPIENT_DICTATION]: viewer can mark as viewed when they are the last recipient', async ({ page }) => {
  const { recipients } = await seedViewerDictationDocument([
    { signingOrder: 1 },
    { signingOrder: 2, role: RecipientRole.VIEWER, sendStatus: SendStatus.NOT_SENT },
  ]);

  const [signer, viewer] = recipients;

  // Advance the flow to the viewer's turn.
  await completeDocumentWithToken({
    token: signer.token,
    id: { type: 'envelopeId', id: signer.envelopeId },
  });

  const signUrl = `/sign/${viewer.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'View Document' })).toBeVisible();

  const dialog = page.getByRole('dialog');

  // Retry the click: it can land before hydration attaches the handler.
  await expect(async () => {
    await page.getByRole('button', { name: 'Mark as viewed', exact: true }).click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass();

  // No dictation inputs: there is nobody after the viewer.
  await expect(dialog.getByText('Next Recipient Name')).not.toBeVisible();

  await dialog.getByRole('button', { name: 'Mark as Viewed', exact: true }).click();

  await page.waitForURL(`${signUrl}/complete`);

  await expect
    .poll(async () => {
      const viewerAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: viewer.id } });

      return viewerAfter.signingStatus;
    })
    .toBe(SigningStatus.SIGNED);
});
