import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, type Page, test } from '@playwright/test';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';

import {
  addEnvelopeItemPdf,
  assertRecipientRole,
  clickAddMyselfButton,
  clickAddSignerButton,
  clickEnvelopeEditorStep,
  dragRecipientRowToGap,
  getEnvelopeEditorSettingsTrigger,
  getRecipientEmailInputs,
  getRecipientNameInputs,
  getRecipientRemoveButtons,
  getRecipientStepCards,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
  setRecipientEmail,
  setRecipientName,
  setRecipientRole,
  type TEnvelopeEditorSurface,
  toggleAllowDictateSigners,
  toggleSigningOrder,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

type RecipientFlowResult = {
  externalId: string;
  expectedRecipientsBySigningOrder: Array<{
    email: string;
    name: string;
    role: RecipientRole;
    signingOrder: number;
  }>;
  removedRecipientEmail: string;
};

const TEST_RECIPIENT_VALUES = {
  secondRecipient: {
    email: 'recipient-two@example.com',
    name: 'Recipient Two',
  },
  thirdRecipient: {
    email: 'recipient-three@example.com',
    name: 'Recipient Three',
  },
  embeddedPrimaryRecipient: {
    email: 'embedded-primary@example.com',
    name: 'Embedded Primary',
  },
};

const openSettingsDialog = async (root: Page) => {
  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
};

const updateExternalId = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await openSettingsDialog(surface.root);
  await surface.root.locator('input[name="externalId"]').fill(externalId);
  await surface.root.getByRole('button', { name: 'Update' }).click();

  if (!surface.isEmbedded) {
    await expectToastTextToBeVisible(surface.root, 'Envelope updated');
  }
};

const navigateToAddFieldsAndBack = async (root: Page) => {
  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(root.getByText('Selected Recipient')).toBeVisible();

  await clickEnvelopeEditorStep(root, 'upload');
  await expect(root.getByRole('heading', { name: 'Recipients' })).toBeVisible();
};

const runRecipientFlow = async (surface: TEnvelopeEditorSurface): Promise<RecipientFlowResult> => {
  const externalId = `e2e-recipients-${nanoid()}`;

  await updateExternalId(surface, externalId);

  let primaryRecipient = TEST_RECIPIENT_VALUES.embeddedPrimaryRecipient;

  if (surface.isEmbedded) {
    await expect(surface.root.getByRole('button', { name: 'Add Myself' })).toHaveCount(0);
    await setRecipientEmail(surface.root, 0, primaryRecipient.email);
    await setRecipientName(surface.root, 0, primaryRecipient.name);
  } else {
    await expect(surface.root.getByRole('button', { name: 'Add Myself' })).toBeVisible();
    await clickAddMyselfButton(surface.root);

    primaryRecipient = {
      email: surface.userEmail,
      name: surface.userName,
    };

    await expect(getRecipientEmailInputs(surface.root).nth(0)).toHaveValue(surface.userEmail);
  }

  await clickAddSignerButton(surface.root);
  await clickAddSignerButton(surface.root);

  await setRecipientEmail(surface.root, 1, TEST_RECIPIENT_VALUES.secondRecipient.email);
  await setRecipientName(surface.root, 1, TEST_RECIPIENT_VALUES.secondRecipient.name);

  await setRecipientEmail(surface.root, 2, TEST_RECIPIENT_VALUES.thirdRecipient.email);
  await setRecipientName(surface.root, 2, TEST_RECIPIENT_VALUES.thirdRecipient.name);

  await setRecipientRole(surface.root, 1, 'Needs to approve');
  await setRecipientRole(surface.root, 2, 'Receives copy');

  // The role selects must reflect the change immediately, without requiring a
  // navigation or reload (regression: leaf controllers going stale after a
  // root-level signers array update).
  await assertRecipientRole(surface.root, 1, 'Needs to approve');
  await assertRecipientRole(surface.root, 2, 'Receives copy');

  await getRecipientRemoveButtons(surface.root).nth(2).click();
  await expect(getRecipientEmailInputs(surface.root)).toHaveCount(2);

  await toggleSigningOrder(surface.root, true);
  await expect(getRecipientStepCards(surface.root)).toHaveCount(2);

  // Reordering is drag-only. Pointer-emulated drags are unreliable inside the
  // embedded authoring surface (its inner scroll container auto-scrolls and
  // cancels the emulated drag), so the drag-swap is exercised on the native
  // surfaces only — the same component drives all surfaces.
  const shouldSwapViaDrag = !surface.isEmbedded;

  if (shouldSwapViaDrag) {
    // Let the debounced autosave from the edits above land before dragging —
    // the editor re-rendering mid-drag would cancel the drag.
    await surface.root.waitForTimeout(1500);

    // Drag the first recipient's row into the gap after the last group,
    // swapping the two.
    await dragRecipientRowToGap(surface.root, 0, 2);
  }

  await toggleAllowDictateSigners(surface.root, true);

  await navigateToAddFieldsAndBack(surface.root);

  const [firstRecipient, secondRecipient] = shouldSwapViaDrag
    ? [TEST_RECIPIENT_VALUES.secondRecipient, primaryRecipient]
    : [primaryRecipient, TEST_RECIPIENT_VALUES.secondRecipient];

  await expect(getRecipientEmailInputs(surface.root)).toHaveCount(2);
  await expect(getRecipientEmailInputs(surface.root).nth(0)).toHaveValue(firstRecipient.email);
  await expect(getRecipientEmailInputs(surface.root).nth(1)).toHaveValue(secondRecipient.email);

  await expect(getRecipientNameInputs(surface.root).nth(0)).toHaveValue(firstRecipient.name);
  await expect(getRecipientNameInputs(surface.root).nth(1)).toHaveValue(secondRecipient.name);

  await assertRecipientRole(surface.root, 0, shouldSwapViaDrag ? 'Needs to approve' : 'Needs to sign');
  await assertRecipientRole(surface.root, 1, shouldSwapViaDrag ? 'Needs to sign' : 'Needs to approve');

  await expect(surface.root.locator('#signingOrder')).toHaveAttribute('aria-checked', 'true');
  await expect(surface.root.locator('#allowDictateNextSigner')).toHaveAttribute('aria-checked', 'true');
  await expect(surface.root.getByText('Group 1', { exact: true })).toBeVisible();
  await expect(surface.root.getByText('Group 2', { exact: true })).toBeVisible();

  return {
    externalId,
    removedRecipientEmail: TEST_RECIPIENT_VALUES.thirdRecipient.email,
    expectedRecipientsBySigningOrder: [
      {
        email: firstRecipient.email,
        name: firstRecipient.name,
        role: shouldSwapViaDrag ? RecipientRole.APPROVER : RecipientRole.SIGNER,
        signingOrder: 1,
      },
      {
        email: secondRecipient.email,
        name: secondRecipient.name,
        role: shouldSwapViaDrag ? RecipientRole.SIGNER : RecipientRole.APPROVER,
        signingOrder: 2,
      },
    ],
  };
};

const assertRecipientsPersistedInDatabase = async ({
  surface,
  externalId,
  expectedRecipientsBySigningOrder,
  removedRecipientEmail,
}: {
  surface: TEnvelopeEditorSurface;
  externalId: string;
  expectedRecipientsBySigningOrder: RecipientFlowResult['expectedRecipientsBySigningOrder'];
  removedRecipientEmail: string;
}) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    include: {
      documentMeta: true,
      recipients: {
        orderBy: {
          signingOrder: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  expect(envelope.recipients).toHaveLength(expectedRecipientsBySigningOrder.length);
  expect(envelope.documentMeta.signingOrder).toBe(DocumentSigningOrder.SEQUENTIAL);
  expect(envelope.documentMeta.allowDictateNextSigner).toBe(true);

  expectedRecipientsBySigningOrder.forEach((expectedRecipient, index) => {
    const recipient = envelope.recipients[index];

    expect(recipient.email).toBe(expectedRecipient.email);
    expect(recipient.name).toBe(expectedRecipient.name);
    expect(recipient.role).toBe(expectedRecipient.role);
    expect(recipient.signingOrder).toBe(expectedRecipient.signingOrder);
  });

  expect(envelope.recipients.some((recipient) => recipient.email === removedRecipientEmail)).toBe(false);
};

test.describe('document editor', () => {
  test('add myself, CRUD, roles, signing order and dictate signers', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runRecipientFlow(surface);

    await assertRecipientsPersistedInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('template editor', () => {
  test('add myself, CRUD, roles, signing order and dictate signers', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runRecipientFlow(surface);

    await assertRecipientsPersistedInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('embedded create', () => {
  test('CRUD, roles, signing order and dictate signers', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-recipients',
    });

    await addEnvelopeItemPdf(surface.root, 'embedded-document-recipients.pdf');

    const result = await runRecipientFlow(surface);
    await persistEmbeddedEnvelope(surface);

    await assertRecipientsPersistedInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('embedded edit', () => {
  test('CRUD, roles, signing order and dictate signers', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-recipients',
    });

    const result = await runRecipientFlow(surface);
    await persistEmbeddedEnvelope(surface);

    await assertRecipientsPersistedInDatabase({
      surface,
      ...result,
    });
  });
});
