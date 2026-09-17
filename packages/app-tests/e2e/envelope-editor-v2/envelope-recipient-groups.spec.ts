import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import {
  clickAddSignerButton,
  dragGroupCardOntoCard,
  dragRecipientRowToGap,
  getRecipientEmailInputs,
  getRecipientStepCards,
  moveGroupCardUp,
  openDocumentEnvelopeEditor,
  openTemplateEnvelopeEditor,
  setRecipientEmail,
  setRecipientName,
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

  // Three standalone groups.
  await expect(root.getByText('Group 1', { exact: true })).toBeVisible();
  await expect(root.getByText('Group 3', { exact: true })).toBeVisible();

  // Drag carol's card onto bob's card to merge them into one group.
  await dragGroupCardOntoCard(root, 2, 1);

  await expect(root.getByText('2 recipients · any order')).toBeVisible();
  await expect(root.getByTestId('ungroup-step-button')).toBeVisible();
  await expect(root.getByText('Group 3', { exact: true })).not.toBeVisible();

  await expectRecipientOrders(surface, [
    ['alice@example.com', 1],
    ['bob@example.com', 2],
    ['carol@example.com', 2],
  ]);

  // Groups survive a reload (grouped normalization on load).
  await root.reload();
  await expect(root.getByText('2 recipients · any order')).toBeVisible();

  // Ungroup dissolves back into sequential groups.
  await root.getByTestId('ungroup-step-button').click();

  await expect(root.getByText('2 recipients · any order')).not.toBeVisible();
  await expect(root.getByText('Group 3', { exact: true })).toBeVisible();

  await expectRecipientOrders(surface, [
    ['alice@example.com', 1],
    ['bob@example.com', 2],
    ['carol@example.com', 3],
  ]);

  // Drag bob's row into the gap after the last group, moving him to the end.
  await dragRecipientRowToGap(root, 1, 3);

  await expectRecipientOrders(surface, [
    ['alice@example.com', 1],
    ['bob@example.com', 3],
    ['carol@example.com', 2],
  ]);
};

test.describe('document editor', () => {
  test('documents: group recipients via drag and drop and ungroup', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await runGroupingFlow(surface);
  });

  test('documents: reordered group cards can still be dragged', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { root } = surface;

    await setRecipientEmail(root, 0, 'alice@example.com');
    await clickAddSignerButton(root);
    await setRecipientEmail(root, 1, 'bob@example.com');

    await toggleSigningOrder(root, true);
    await expect(getRecipientStepCards(root)).toHaveCount(2);

    // Move bob's card into position 1.
    await moveGroupCardUp(root, 1);

    await expect(getRecipientEmailInputs(root).nth(0)).toHaveValue('bob@example.com');
    await expect(getRecipientEmailInputs(root).nth(1)).toHaveValue('alice@example.com');

    // Regression: after a reorder, the card moved into position 2 must still
    // be draggable — positional drag-and-drop ids used to go stale on mounted
    // cards, silently killing their drag handles. Prove it by completing a
    // merge with the repositioned card.
    await dragGroupCardOntoCard(root, 1, 0);

    await expect(root.getByText('2 recipients · any order')).toBeVisible();
  });
});

test.describe('template editor', () => {
  test('templates: group recipients via drag and drop and ungroup', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    await runGroupingFlow(surface);
  });
});
