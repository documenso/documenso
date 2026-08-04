import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import {
  clickAddSignerButton,
  getSigningOrderInputs,
  openDocumentEnvelopeEditor,
  openTemplateEnvelopeEditor,
  setRecipientEmail,
  setRecipientName,
  setSigningOrderValue,
  type TEnvelopeEditorSurface,
  toggleSigningOrder,
} from '../fixtures/envelope-editor';

const expectRecipientOrders = async (surface: TEnvelopeEditorSurface, expected: Array<[string, number]>) => {
  const { envelopeId } = surface;

  if (!envelopeId) {
    throw new Error('Expected surface to have an envelope ID');
  }

  await expect
    .poll(
      async () => {
        const recipients = await prisma.recipient.findMany({
          where: { envelopeId },
        });

        return recipients.map((r) => [r.email, r.signingOrder] as const).sort((a, b) => a[0].localeCompare(b[0]));
      },
      { timeout: 15_000 },
    )
    .toEqual([...expected].sort((a, b) => a[0].localeCompare(b[0])));
};

const runGroupingFlow = async (surface: TEnvelopeEditorSurface) => {
  const { root } = surface;

  await setRecipientEmail(root, 0, 'alice@example.com');
  await setRecipientName(root, 0, 'Alice');

  await clickAddSignerButton(root);
  await setRecipientEmail(root, 1, 'bob@example.com');

  await clickAddSignerButton(root);
  await setRecipientEmail(root, 2, 'carol@example.com');

  await toggleSigningOrder(root, true);

  // Three standalone steps.
  await expect(root.getByText('Step 1', { exact: true })).toBeVisible();
  await expect(root.getByText('Step 3', { exact: true })).toBeVisible();

  // Type-to-join: carol (step 3) joins bob (step 2).
  await setSigningOrderValue(root, 2, 2);

  await expect(root.getByText('2 signers · any order')).toBeVisible();
  await expect(root.getByTestId('ungroup-step-button')).toBeVisible();
  await expect(root.getByText('Step 3', { exact: true })).not.toBeVisible();

  const orderInputs = getSigningOrderInputs(root);
  await expect(orderInputs.nth(1)).toHaveValue('2');
  await expect(orderInputs.nth(2)).toHaveValue('2');

  await expectRecipientOrders(surface, [
    ['alice@example.com', 1],
    ['bob@example.com', 2],
    ['carol@example.com', 2],
  ]);

  // Groups survive a reload (grouped normalization on load).
  await root.reload();
  await expect(root.getByText('2 signers · any order')).toBeVisible();

  // Ungroup dissolves back into sequential steps.
  await root.getByTestId('ungroup-step-button').click();

  await expect(root.getByText('2 signers · any order')).not.toBeVisible();
  await expect(root.getByText('Step 3', { exact: true })).toBeVisible();

  await expectRecipientOrders(surface, [
    ['alice@example.com', 1],
    ['bob@example.com', 2],
    ['carol@example.com', 3],
  ]);

  // Out-of-bounds extraction: bob (step 2) types 4 (> 3 steps) and becomes the
  // last standalone step.
  await setSigningOrderValue(root, 1, 4);

  await expectRecipientOrders(surface, [
    ['alice@example.com', 1],
    ['bob@example.com', 3],
    ['carol@example.com', 2],
  ]);
};

test.describe('document editor', () => {
  test('documents: group recipients via signing order input and ungroup', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await runGroupingFlow(surface);
  });
});

test.describe('template editor', () => {
  test('templates: group recipients via signing order input and ungroup', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    await runGroupingFlow(surface);
  });
});
