import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';

import { apiSeedDirectTemplate, apiSeedPendingDocument } from '../fixtures/api-seeds';
import {
  clickSigningField,
  completeSigning,
  expectFieldsInDatabase,
  expectFieldsRemaining,
  getCompleteButton,
  getGroupBar,
  getNextFieldButton,
  openSigningPage,
  setupTypedSignature,
} from '../fixtures/envelope-signing';
import { clickKonvaFieldOption, getKonvaFieldText } from '../fixtures/konva';

const FIELD_SIZE = { width: 20, height: 5 };

const SIGNATURE_FIELD = { type: FieldType.SIGNATURE, page: 1, positionX: 60, positionY: 5, ...FIELD_SIZE };

const option = (id: number, value: string, checked = false) => ({ id, checked, value });

const findFieldByExternalId = <T extends { externalId?: string | null }>(fields: T[], externalId: string): T => {
  const field = fields.find((field) => field.externalId === externalId);

  if (!field) {
    throw new Error(`Field with external ID ${externalId} not found`);
  }

  return field;
};

const findFieldByType = <T extends { type: FieldType }>(fields: T[], type: FieldType): T => {
  const field = fields.find((field) => field.type === type);

  if (!field) {
    throw new Error(`Field of type ${type} not found`);
  }

  return field;
};

test.describe('V2 envelope field groups during signing', () => {
  test('shared value and radio groups act as a single field', async ({ page, request }) => {
    const textGroupId = 'grp_text';
    const radioGroupId = 'grp_radio';

    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: 'signer-groups@test.documenso.com', name: 'Group Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 10,
            ...FIELD_SIZE,
            groupId: textGroupId,
            externalId: 'text-a',
            fieldMeta: { type: 'text', required: true, label: 'Company' },
          },
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 20,
            ...FIELD_SIZE,
            groupId: textGroupId,
            externalId: 'text-b',
            fieldMeta: { type: 'text', required: true, label: 'Company' },
          },
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 30,
            ...FIELD_SIZE,
            externalId: 'text-optional',
            fieldMeta: { type: 'text', required: false, label: 'Notes' },
          },
          {
            type: FieldType.RADIO,
            page: 1,
            positionX: 5,
            positionY: 45,
            ...FIELD_SIZE,
            groupId: radioGroupId,
            externalId: 'radio-a',
            fieldMeta: { type: 'radio', required: true, values: [option(1, 'A1'), option(2, 'A2')] },
          },
          {
            type: FieldType.RADIO,
            page: 1,
            positionX: 5,
            positionY: 60,
            ...FIELD_SIZE,
            groupId: radioGroupId,
            externalId: 'radio-b',
            fieldMeta: { type: 'radio', required: true, values: [option(1, 'B1')] },
          },
        ],
      ],
    });

    const { token } = distributeResult.recipients[0];
    const { fields } = envelope;

    const textA = findFieldByExternalId(fields, 'text-a');
    const textB = findFieldByExternalId(fields, 'text-b');
    const textOptional = findFieldByExternalId(fields, 'text-optional');
    const radioA = findFieldByExternalId(fields, 'radio-a');
    const radioB = findFieldByExternalId(fields, 'radio-b');

    const canvas = await openSigningPage(page, `/sign/${token}`);

    // Signature + text group + radio group. The optional text field is not counted.
    await expectFieldsRemaining(page, 3);

    expect(await getKonvaFieldText(page, 1, textOptional.id)).toBe('Notes');

    // Filling one text field fills every member of the group.
    await clickSigningField(canvas, textA);
    await expect(page.getByRole('heading', { name: 'Company' })).toBeVisible();
    await page.getByRole('dialog').locator('textarea').fill('Acme Inc');
    await page.getByRole('button', { name: 'Enter' }).click();

    await expectFieldsInDatabase([
      { fieldId: textA.id, inserted: true, customText: 'Acme Inc' },
      { fieldId: textB.id, inserted: true, customText: 'Acme Inc' },
    ]);
    await expectFieldsRemaining(page, 2);

    // Clearing the other member clears the whole group.
    await clickSigningField(canvas, textB);

    await expectFieldsInDatabase([
      { fieldId: textA.id, inserted: false, customText: '' },
      { fieldId: textB.id, inserted: false, customText: '' },
    ]);
    await expectFieldsRemaining(page, 3);

    // Selecting a radio option marks the whole group as answered with one selection.
    await clickKonvaFieldOption(page, 1, radioA.id, { type: 'radio', index: 1 });

    await expectFieldsInDatabase([
      { fieldId: radioA.id, inserted: true, customText: '1' },
      { fieldId: radioB.id, inserted: true, customText: '' },
    ]);
    await expectFieldsRemaining(page, 2);

    // Selecting on the sibling moves the selection.
    await clickKonvaFieldOption(page, 1, radioB.id, { type: 'radio', index: 0 });

    await expectFieldsInDatabase([
      { fieldId: radioA.id, inserted: true, customText: '' },
      { fieldId: radioB.id, inserted: true, customText: '0' },
    ]);
    await expectFieldsRemaining(page, 2);

    // Clicking the selected option again clears the whole group.
    await clickKonvaFieldOption(page, 1, radioB.id, { type: 'radio', index: 0 });

    await expectFieldsInDatabase([
      { fieldId: radioA.id, inserted: false, customText: '' },
      { fieldId: radioB.id, inserted: false, customText: '' },
    ]);
    await expectFieldsRemaining(page, 3);
  });

  test('checkbox selections are pooled and validated on completion', async ({ page, request }) => {
    const checkboxGroupId = 'grp_checkbox';

    const atLeastTwo = { validationRule: 'Select at least', validationLength: 2 };
    const exactlyOne = { validationRule: 'Select exactly', validationLength: 1 };

    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: 'signer-checkbox-groups@test.documenso.com', name: 'Checkbox Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 10,
            ...FIELD_SIZE,
            groupId: checkboxGroupId,
            externalId: 'checkbox-a',
            fieldMeta: { type: 'checkbox', required: true, values: [option(1, 'A1'), option(2, 'A2')], ...atLeastTwo },
          },
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 25,
            ...FIELD_SIZE,
            groupId: checkboxGroupId,
            externalId: 'checkbox-b',
            fieldMeta: { type: 'checkbox', required: true, values: [option(1, 'B1'), option(2, 'B2')], ...atLeastTwo },
          },
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 45,
            ...FIELD_SIZE,
            externalId: 'checkbox-optional',
            fieldMeta: { type: 'checkbox', required: false, values: [option(1, 'O1'), option(2, 'O2')], ...exactlyOne },
          },
        ],
      ],
    });

    const { token } = distributeResult.recipients[0];
    const { fields } = envelope;

    const signatureField = findFieldByType(fields, FieldType.SIGNATURE);
    const checkboxA = findFieldByExternalId(fields, 'checkbox-a');
    const checkboxB = findFieldByExternalId(fields, 'checkbox-b');
    const checkboxOptional = findFieldByExternalId(fields, 'checkbox-optional');

    const canvas = await openSigningPage(page, `/sign/${token}`);

    // Signature + checkbox group. The optional checkbox is not counted while untouched.
    await expectFieldsRemaining(page, 2);

    await setupTypedSignature(page);
    await clickSigningField(canvas, signatureField);
    await expectFieldsInDatabase([{ fieldId: signatureField.id, inserted: true }]);
    await expectFieldsRemaining(page, 1);

    // A single tick is accepted without a dialog, but the group does not satisfy its rule.
    await clickKonvaFieldOption(page, 1, checkboxA.id, { type: 'checkbox', index: 0 });

    await expectFieldsInDatabase([
      { fieldId: checkboxA.id, inserted: true, customText: '[0]' },
      { fieldId: checkboxB.id, inserted: true, customText: '' },
    ]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectFieldsRemaining(page, 1);

    await expect(getCompleteButton(page)).toHaveCount(0);
    await getNextFieldButton(page).click();
    await expect(page.getByText('Select at least 2 options')).toBeVisible();

    // Pointing out a pending grouped field also shows its group bar, so touch devices can
    // reach it, coloured to match the pending state.
    await expect(getGroupBar(page, checkboxA.id)).toContainText('1 of 2');

    // Ticking an option on the sibling satisfies the pooled rule.
    await clickKonvaFieldOption(page, 1, checkboxB.id, { type: 'checkbox', index: 1 });

    await expectFieldsInDatabase([
      { fieldId: checkboxA.id, inserted: true, customText: '[0]' },
      { fieldId: checkboxB.id, inserted: true, customText: '[1]' },
    ]);
    await expectFieldsRemaining(page, 0);
    await expect(getCompleteButton(page)).toBeVisible();

    // Inserting the optional checkbox makes its rule apply.
    await clickKonvaFieldOption(page, 1, checkboxOptional.id, { type: 'checkbox', index: 0 });
    await expectFieldsInDatabase([{ fieldId: checkboxOptional.id, inserted: true, customText: '[0]' }]);
    await expectFieldsRemaining(page, 0);

    await clickKonvaFieldOption(page, 1, checkboxOptional.id, { type: 'checkbox', index: 1 });
    await expectFieldsInDatabase([{ fieldId: checkboxOptional.id, inserted: true, customText: '[0,1]' }]);
    await expectFieldsRemaining(page, 1);

    await getNextFieldButton(page).click();
    await expect(page.getByText('Select exactly 1 option')).toBeVisible();

    await clickKonvaFieldOption(page, 1, checkboxOptional.id, { type: 'checkbox', index: 1 });

    await expectFieldsInDatabase([{ fieldId: checkboxOptional.id, inserted: true, customText: '[0]' }]);
    await expectFieldsRemaining(page, 0);

    await completeSigning(page);

    await page.waitForURL(`/sign/${token}/complete`);
    await expect(page.getByText('Document Signed')).toBeVisible();

    await expect(async () => {
      const dbEnvelope = await prisma.envelope.findUniqueOrThrow({ where: { id: envelope.id } });

      expect(dbEnvelope.status).toBe(DocumentStatus.COMPLETED);
    }).toPass();
  });

  test('direct template completion enforces grouped checkbox rules', async ({ page, request }) => {
    const checkboxGroupId = 'grp_direct_checkbox';
    const atLeastTwo = { validationRule: 'Select at least', validationLength: 2 };

    const directRecipient = {
      email: 'direct-group-recipient@documenso.com',
      name: 'Direct Group Recipient',
      role: 'SIGNER' as const,
    };

    const { envelope, directLink } = await apiSeedDirectTemplate(request, {
      title: '[TEST] Direct template with grouped checkboxes',
      recipients: [directRecipient],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 10,
            ...FIELD_SIZE,
            groupId: checkboxGroupId,
            externalId: 'checkbox-a',
            fieldMeta: { type: 'checkbox', required: true, values: [option(1, 'A1')], ...atLeastTwo },
          },
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 25,
            ...FIELD_SIZE,
            groupId: checkboxGroupId,
            externalId: 'checkbox-b',
            fieldMeta: { type: 'checkbox', required: true, values: [option(1, 'B1')], ...atLeastTwo },
          },
        ],
      ],
    });

    const { fields } = envelope;

    const signatureField = findFieldByType(fields, FieldType.SIGNATURE);
    const checkboxA = findFieldByExternalId(fields, 'checkbox-a');
    const checkboxB = findFieldByExternalId(fields, 'checkbox-b');

    const canvas = await openSigningPage(page, `/d/${directLink.token}`);

    await setupTypedSignature(page);
    await clickSigningField(canvas, signatureField);

    // One tick across the group does not satisfy the rule so completion is blocked.
    await clickKonvaFieldOption(page, 1, checkboxA.id, { type: 'checkbox', index: 0 });
    await expectFieldsRemaining(page, 1);
    await expect(getCompleteButton(page)).toHaveCount(0);

    await getNextFieldButton(page).click();
    await expect(page.getByText('Select at least 2 options')).toBeVisible();

    await clickKonvaFieldOption(page, 1, checkboxB.id, { type: 'checkbox', index: 0 });
    await expectFieldsRemaining(page, 0);

    await completeSigning(page, { name: 'Direct Signer', email: 'direct-group-signer@test.documenso.com' });

    await page.waitForURL(/\/sign\/.+\/complete/);
    await expect(page.getByText('Document Signed')).toBeVisible();

    // The created document carries the group with every member inserted.
    await expect(async () => {
      const createdDocument = await prisma.envelope.findFirstOrThrow({
        where: {
          type: 'DOCUMENT',
          templateId: mapSecondaryIdToTemplateId(envelope.secondaryId),
        },
        include: { fields: true },
        orderBy: { createdAt: 'desc' },
      });

      const groupFields = createdDocument.fields.filter((field) => field.groupId === checkboxGroupId);

      expect(groupFields).toHaveLength(2);
      expect(groupFields.every((field) => field.inserted)).toBe(true);
      expect(groupFields.map((field) => field.customText).sort()).toEqual(['[0]', '[0]']);
    }).toPass();
  });
});
