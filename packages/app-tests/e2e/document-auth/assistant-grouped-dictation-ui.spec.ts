import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, FieldType, RecipientRole, SigningStatus } from '@prisma/client';

import { signDirectSignaturePad } from '../fixtures/signature';

/**
 * An assistant sharing a signing step with an unsigned peer cannot dictate
 * the next signer: the flow does not advance until the whole step completes,
 * so the server ignores any dictated identity. The signing page must
 * therefore not OFFER dictation in that state — historically it did, because
 * the assistant's recipient list excludes their own group peers, and the
 * client derived dictation eligibility from that truncated list while the
 * server decided from the full one.
 */
test('[NEXT_RECIPIENT_DICTATION]: assistant with an unsigned group peer is not offered dictation', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: assistant } = await seedUser();
  const { user: peerSigner } = await seedUser();
  const { user: lastSigner } = await seedUser();

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [assistant, peerSigner, lastSigner],
    recipientsCreateOptions: [
      // The assistant shares step 1 with an unsigned peer; step 2 holds a
      // single recipient — the exact shape where dictation looks available
      // from the assistant's truncated recipient list.
      { signingOrder: 1, role: RecipientRole.ASSISTANT },
      { signingOrder: 1, role: RecipientRole.SIGNER },
      { signingOrder: 2, role: RecipientRole.SIGNER },
    ],
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

  const assistantRecipient = recipients[0];
  const lastRecipient = recipients[2];

  const signUrl = `/sign/${assistantRecipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Assist Document' })).toBeVisible();

  await page.waitForTimeout(1000);

  await page.getByRole('radio', { name: assistantRecipient.name }).click();

  // Fill in the assistant's own fields.
  for (const field of assistantRecipient.fields) {
    await page.locator(`#field-${field.id}`).getByRole('button').click();

    if (field.type === FieldType.SIGNATURE) {
      await signDirectSignaturePad(page);
      await page.getByRole('button', { name: 'Sign', exact: true }).click();
    }

    if (field.type === FieldType.TEXT) {
      await page.locator('#custom-text').fill('TEXT');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
  }

  await page.getByRole('button', { name: 'Continue' }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog).toBeVisible();

  // The unsigned peer blocks advancement, so dictation must not be offered.
  await expect(dialog.getByText('The next recipient to sign this document will be')).not.toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Update Recipient' })).not.toBeVisible();

  // Later recipients' fields are still uninserted, so the confirm button
  // reads "Proceed" rather than "Continue".
  await dialog.getByRole('button', { name: /Continue|Proceed/ }).click();
  await page.waitForURL(`${signUrl}/complete`);

  // The assistant completed; nobody was renamed and the flow did not advance
  // past the unsigned peer.
  await expect
    .poll(async () => {
      const assistantAfter = await prisma.recipient.findUniqueOrThrow({
        where: { id: assistantRecipient.id },
      });

      return assistantAfter.signingStatus;
    })
    .toBe(SigningStatus.SIGNED);

  const lastAfter = await prisma.recipient.findUniqueOrThrow({ where: { id: lastRecipient.id } });

  expect(lastAfter.name).toBe(lastRecipient.name);
  expect(lastAfter.email).toBe(lastRecipient.email);

  const envelope = await prisma.envelope.findUniqueOrThrow({ where: { id: document.id } });

  expect(envelope.status).toBe('PENDING');
});
