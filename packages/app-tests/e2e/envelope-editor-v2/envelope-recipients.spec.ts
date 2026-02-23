import { type Page, expect, test } from '@playwright/test';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import {
  type TEnvelopeEditorSurface,
  addEnvelopeItemPdf,
  assertRecipientRole,
  clickAddMyselfButton,
  clickAddSignerButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  getRecipientEmailInputs,
  getRecipientNameInputs,
  getRecipientRemoveButtons,
  getSigningOrderInputs,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
  setRecipientEmail,
  setRecipientName,
  setRecipientRole,
  setSigningOrderValue,
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

  await getRecipientRemoveButtons(surface.root).nth(2).click();
  await expect(getRecipientEmailInputs(surface.root)).toHaveCount(2);

  await toggleSigningOrder(surface.root, true);
  await expect(getSigningOrderInputs(surface.root)).toHaveCount(2);
  await setSigningOrderValue(surface.root, 0, 2);

  await toggleAllowDictateSigners(surface.root, true);

  await navigateToAddFieldsAndBack(surface.root);

  await expect(getRecipientEmailInputs(surface.root)).toHaveCount(2);
  await expect(getRecipientEmailInputs(surface.root).nth(0)).toHaveValue(
    TEST_RECIPIENT_VALUES.secondRecipient.email,
  );
  await expect(getRecipientEmailInputs(surface.root).nth(1)).toHaveValue(primaryRecipient.email);

  await expect(getRecipientNameInputs(surface.root).nth(0)).toHaveValue(
    TEST_RECIPIENT_VALUES.secondRecipient.name,
  );
  await expect(getRecipientNameInputs(surface.root).nth(1)).toHaveValue(primaryRecipient.name);

  await assertRecipientRole(surface.root, 0, 'Needs to approve');
  await assertRecipientRole(surface.root, 1, 'Needs to sign');

  await expect(surface.root.locator('#signingOrder')).toHaveAttribute('aria-checked', 'true');
  await expect(surface.root.locator('#allowDictateNextSigner')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(getSigningOrderInputs(surface.root).nth(0)).toHaveValue('1');
  await expect(getSigningOrderInputs(surface.root).nth(1)).toHaveValue('2');

  return {
    externalId,
    removedRecipientEmail: TEST_RECIPIENT_VALUES.thirdRecipient.email,
    expectedRecipientsBySigningOrder: [
      {
        email: TEST_RECIPIENT_VALUES.secondRecipient.email,
        name: TEST_RECIPIENT_VALUES.secondRecipient.name,
        role: RecipientRole.APPROVER,
        signingOrder: 1,
      },
      {
        email: primaryRecipient.email,
        name: primaryRecipient.name,
        role: RecipientRole.SIGNER,
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

  expect(envelope.recipients.some((recipient) => recipient.email === removedRecipientEmail)).toBe(
    false,
  );
};

test.describe('Envelope Editor V2 - Recipients', () => {
  test('documents/<id>: add myself, CRUD, roles, signing order and dictate signers', async ({
    page,
  }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runRecipientFlow(surface);

    await assertRecipientsPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('templates/<id>: add myself, CRUD, roles, signing order and dictate signers', async ({
    page,
  }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runRecipientFlow(surface);

    await assertRecipientsPersistedInDatabase({
      surface,
      ...result,
    });
  });

  test('/embed/v2/authoring/envelope/create DOCUMENT: recipients settings persist after create', async ({
    page,
  }) => {
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

  test('/embed/v2/authoring/envelope/edit/<id> TEMPLATE: recipients settings persist after update', async ({
    page,
  }) => {
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
