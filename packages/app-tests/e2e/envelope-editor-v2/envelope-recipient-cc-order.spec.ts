import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import {
  assertRecipientRole,
  getRecipientEmailInputs,
  getRecipientRows,
  getSigningOrderInputs,
  openDocumentEnvelopeEditor,
  setRecipientEmail,
  setRecipientName,
  setRecipientRole,
  toggleSigningOrder,
} from '../fixtures/envelope-editor';

const SIGNER_A = { email: 'cc-order-signer-a@example.com', name: 'Signer A' };
const SIGNER_B = { email: 'cc-order-signer-b@example.com', name: 'Signer B' };
const CC_RECIPIENT = { email: 'cc-order-cc@example.com', name: 'CC Recipient' };

const assertCcDisplayedLastWithNoOrderInput = async (root: Page) => {
  // CC recipient is displayed last despite being added/stored mid-list.
  await expect(getRecipientEmailInputs(root)).toHaveCount(3);
  await expect(getRecipientEmailInputs(root).nth(0)).toHaveValue(SIGNER_A.email);
  await expect(getRecipientEmailInputs(root).nth(1)).toHaveValue(SIGNER_B.email);
  await expect(getRecipientEmailInputs(root).nth(2)).toHaveValue(CC_RECIPIENT.email);

  await assertRecipientRole(root, 0, 'Needs to sign');
  await assertRecipientRole(root, 1, 'Needs to sign');
  await assertRecipientRole(root, 2, 'Receives copy');

  // Only the two signers have signing order inputs, showing 1 and 2.
  await expect(getSigningOrderInputs(root)).toHaveCount(2);
  await expect(getSigningOrderInputs(root).nth(0)).toHaveValue('1');
  await expect(getSigningOrderInputs(root).nth(1)).toHaveValue('2');

  // The CC row itself renders no signing order input (placeholder div instead).
  const ccRow = getRecipientRows(root).nth(2);
  await expect(ccRow.locator('[data-testid="signing-order-input"]')).toHaveCount(0);
};

test.describe('document editor', () => {
  test('CC recipient added mid-list is displayed last with no signing order input', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { root } = surface;

    await toggleSigningOrder(root, true);

    // Add signer A into the initial empty row.
    await setRecipientEmail(root, 0, SIGNER_A.email);
    await setRecipientName(root, 0, SIGNER_A.name);

    // Add the CC recipient second.
    await root.getByRole('button', { name: 'Add Signer' }).click();
    await setRecipientEmail(root, 1, CC_RECIPIENT.email);
    await setRecipientName(root, 1, CC_RECIPIENT.name);
    await setRecipientRole(root, 1, 'Receives copy');

    // Once the row becomes CC, its signing order input disappears.
    await expect(getSigningOrderInputs(root)).toHaveCount(1);

    // Add signer B third. The new row is inserted before the CC recipient,
    // which is kept last by the client-side sorting.
    await root.getByRole('button', { name: 'Add Signer' }).click();
    await expect(getRecipientEmailInputs(root).nth(2)).toHaveValue(CC_RECIPIENT.email);

    await setRecipientEmail(root, 1, SIGNER_B.email);
    await setRecipientName(root, 1, SIGNER_B.name);

    await assertCcDisplayedLastWithNoOrderInput(root);

    // The editor autosaves with a debounce, poll the DB until all three
    // recipients have been persisted before reloading the page.
    await expect
      .poll(
        async () => {
          const recipients = await prisma.recipient.findMany({
            where: { envelopeId: surface.envelopeId },
          });

          return recipients.length;
        },
        { timeout: 15_000 },
      )
      .toBe(3);

    // Reload the editor and assert the CC recipient is still displayed last.
    await root.reload();
    await expect(root.getByRole('heading', { name: 'Recipients' })).toBeVisible();

    await assertCcDisplayedLastWithNoOrderInput(root);
  });

  test('CC recipient seeded with mid-list signing order is displayed last', async ({ page }) => {
    const { user, team } = await seedUser();

    const document = await seedBlankDocument(user, team.id, {
      internalVersion: 2,
    });

    // Seed a CC recipient directly in the DB with a mid-list signing order
    // (2 of 3) BEFORE opening the editor, so the editor's autosave cannot
    // race with the seeded recipients, and assert the editor renders it last.
    await prisma.envelope.update({
      where: { id: document.id },
      data: {
        documentMeta: {
          update: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
        },
        recipients: {
          createMany: {
            data: [
              {
                email: SIGNER_A.email,
                name: SIGNER_A.name,
                token: nanoid(),
                role: RecipientRole.SIGNER,
                signingOrder: 1,
              },
              {
                email: CC_RECIPIENT.email,
                name: CC_RECIPIENT.name,
                token: nanoid(),
                role: RecipientRole.CC,
                signingOrder: 2,
              },
              {
                email: SIGNER_B.email,
                name: SIGNER_B.name,
                token: nanoid(),
                role: RecipientRole.SIGNER,
                signingOrder: 3,
              },
            ],
          },
        },
      },
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit?step=uploadAndRecipients`,
    });

    await expect(page.getByRole('heading', { name: 'Recipients' })).toBeVisible();

    await assertCcDisplayedLastWithNoOrderInput(page);
  });
});
