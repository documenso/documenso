import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';

import {
  apiCreateEnvelopeItem,
  apiCreateFields,
  apiDistributeEnvelope,
  apiGetEnvelope,
  apiSeedDirectTemplate,
  apiSeedDraftDocument,
  apiSeedPendingDocument,
} from '../fixtures/api-seeds';
import {
  clickSigningField,
  completeSigning,
  expectFieldsInDatabase,
  expectFieldsRemaining,
  getCompleteButton,
  getGroupBar,
  getNextFieldButton,
  hoverSigningField,
  openSigningPage,
  setupTypedSignature,
} from '../fixtures/envelope-signing';
import {
  clickKonvaFieldOption,
  getKonvaCheckedCheckboxIndices,
  getKonvaFieldBackground,
  getKonvaFieldTextForPage,
} from '../fixtures/konva';

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

    // Signature + both text group fields + both radio group fields. The optional text
    // field is not counted.
    await expectFieldsRemaining(page, 5);

    expect(await getKonvaFieldTextForPage(page, 1, textOptional.id)).toBe('Notes');

    // Filling one text field fills every field in the group.
    await clickSigningField(canvas, textA);
    await expect(page.getByRole('heading', { name: 'Company' })).toBeVisible();
    await page.getByRole('dialog').locator('textarea').fill('Acme Inc');
    await page.getByRole('button', { name: 'Enter' }).click();

    await expectFieldsInDatabase([
      { fieldId: textA.id, inserted: true, customText: 'Acme Inc' },
      { fieldId: textB.id, inserted: true, customText: 'Acme Inc' },
    ]);
    await expectFieldsRemaining(page, 3);

    // Removing the value from the other field clears the whole group.
    await clickSigningField(canvas, textB);
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();

    await expectFieldsInDatabase([
      { fieldId: textA.id, inserted: false, customText: '' },
      { fieldId: textB.id, inserted: false, customText: '' },
    ]);
    await expectFieldsRemaining(page, 5);

    // Selecting a radio option marks the whole group as answered with one selection.
    await clickKonvaFieldOption(page, 1, radioA.id, { type: 'radio', index: 1 });

    await expectFieldsInDatabase([
      { fieldId: radioA.id, inserted: true, customText: '1' },
      { fieldId: radioB.id, inserted: true, customText: '' },
    ]);
    await expectFieldsRemaining(page, 3);

    // Selecting on the sibling moves the selection.
    await clickKonvaFieldOption(page, 1, radioB.id, { type: 'radio', index: 0 });

    await expectFieldsInDatabase([
      { fieldId: radioA.id, inserted: true, customText: '' },
      { fieldId: radioB.id, inserted: true, customText: '0' },
    ]);
    await expectFieldsRemaining(page, 3);

    // Clicking the selected option again clears the whole group.
    await clickKonvaFieldOption(page, 1, radioB.id, { type: 'radio', index: 0 });

    await expectFieldsInDatabase([
      { fieldId: radioA.id, inserted: false, customText: '' },
      { fieldId: radioB.id, inserted: false, customText: '' },
    ]);
    await expectFieldsRemaining(page, 5);
  });

  test('checkbox selections are counted across the group and validated on completion', async ({ page, request }) => {
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

    // Signature + both checkbox group fields. The optional checkbox is not counted while
    // untouched.
    await expectFieldsRemaining(page, 3);

    await setupTypedSignature(page, 'Jane Signer');
    await clickSigningField(canvas, signatureField);
    await expectFieldsInDatabase([{ fieldId: signatureField.id, inserted: true }]);
    await expectFieldsRemaining(page, 2);
    expect(await getKonvaFieldTextForPage(page, 1, signatureField.id)).toBe('Jane Signer');

    // Removing the signature clears it from the canvas without a refresh.
    await clickSigningField(canvas, signatureField);
    await expectFieldsInDatabase([{ fieldId: signatureField.id, inserted: false }]);
    await expect.poll(async () => await getKonvaFieldTextForPage(page, 1, signatureField.id)).toBe('Signature');

    await clickSigningField(canvas, signatureField);
    await expectFieldsInDatabase([{ fieldId: signatureField.id, inserted: true }]);
    await expectFieldsRemaining(page, 2);

    // A single tick is accepted without a dialog, but the group does not satisfy its rule,
    // so the field without a selection still counts.
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

    // Ticking an option on the sibling satisfies the group's rule.
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

  test('a redrawn field keeps its hover tint and leaves the other fields alone', async ({ page, request }) => {
    const checkboxField = (externalId: string, positionY: number) => ({
      type: FieldType.CHECKBOX,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      externalId,
      fieldMeta: { type: 'checkbox', required: true, values: [option(1, 'One'), option(2, 'Two')] },
    });

    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: 'signer-redraw@test.documenso.com', name: 'Redraw Signer' }],
      fieldsPerRecipient: [[SIGNATURE_FIELD, checkboxField('checkbox-a', 10), checkboxField('checkbox-b', 30)]],
    });

    const { token } = distributeResult.recipients[0];

    const checkboxA = findFieldByExternalId(envelope.fields, 'checkbox-a');
    const checkboxB = findFieldByExternalId(envelope.fields, 'checkbox-b');

    const canvas = await openSigningPage(page, `/sign/${token}`);

    const restingBackground = await getKonvaFieldBackground(page, 1, checkboxA.id);

    await hoverSigningField(canvas, checkboxA);
    await expect
      .poll(async () => (await getKonvaFieldBackground(page, 1, checkboxA.id))?.fill)
      .not.toBe(restingBackground?.fill);

    // Ticking redraws the field under the pointer, which has not moved.
    await clickKonvaFieldOption(page, 1, checkboxA.id, { type: 'checkbox', index: 0 });
    await expectFieldsInDatabase([{ fieldId: checkboxA.id, inserted: true, customText: '[0]' }]);
    await expect
      .poll(async () => (await getKonvaFieldBackground(page, 1, checkboxA.id))?.rectId)
      .not.toBe(restingBackground?.rectId);

    const redrawnBackground = await getKonvaFieldBackground(page, 1, checkboxA.id);

    expect(redrawnBackground?.fill).not.toBe(restingBackground?.fill);
    expect(redrawnBackground?.mouseEnterListenerCount).toBe(1);

    // The tint goes once the pointer leaves the field.
    await hoverSigningField(canvas, checkboxB);
    await expect
      .poll(async () => (await getKonvaFieldBackground(page, 1, checkboxA.id))?.fill)
      .toBe(restingBackground?.fill);

    // While pending fields are pointed out, a change to one field does not redraw the rest.
    await getNextFieldButton(page).click();
    await expect(page.getByText('Click to insert field')).toBeVisible();

    const otherBackground = await getKonvaFieldBackground(page, 1, checkboxB.id);

    await clickKonvaFieldOption(page, 1, checkboxA.id, { type: 'checkbox', index: 1 });
    await expectFieldsInDatabase([{ fieldId: checkboxA.id, inserted: true, customText: '[0,1]' }]);
    await expect
      .poll(async () => (await getKonvaFieldBackground(page, 1, checkboxA.id))?.rectId)
      .not.toBe(redrawnBackground?.rectId);

    expect((await getKonvaFieldBackground(page, 1, checkboxB.id))?.rectId).toBe(otherBackground?.rectId);
  });

  test.describe('with custom field CSS', () => {
    // Custom CSS can only set field colours on an embed, but the signing page reads the
    // field colours the same way, so the CSS is added to the page directly. The page's
    // Content Security Policy blocks inline styles, so it is bypassed here.
    test.use({ bypassCSP: true });

    test('custom field colours switch off the hover tint', async ({ page, request }) => {
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = '.field--FieldRootContainer { border: 2px solid rgb(255, 0, 0); }';
          document.head.appendChild(style);
        });
      });

      const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
        recipients: [{ email: 'signer-custom-colours@test.documenso.com', name: 'Custom Colours Signer' }],
        fieldsPerRecipient: [
          [
            SIGNATURE_FIELD,
            {
              type: FieldType.CHECKBOX,
              page: 1,
              positionX: 5,
              positionY: 10,
              ...FIELD_SIZE,
              externalId: 'checkbox',
              fieldMeta: { type: 'checkbox', required: true, values: [option(1, 'One')] },
            },
          ],
        ],
      });

      const checkbox = findFieldByExternalId(envelope.fields, 'checkbox');

      const canvas = await openSigningPage(page, `/sign/${distributeResult.recipients[0].token}`);

      const restingBackground = await getKonvaFieldBackground(page, 1, checkbox.id);

      expect(restingBackground?.stroke).toBe('rgb(255, 0, 0)');

      await hoverSigningField(canvas, checkbox);

      // The tint fades in over 0.3s when it is on.
      await page.waitForTimeout(500);

      expect((await getKonvaFieldBackground(page, 1, checkbox.id))?.fill).toBe(restingBackground?.fill);
    });
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

    // The created document carries the group with every field inserted.
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

  test('direct template keeps every tick made across a checkbox group', async ({ page, request }) => {
    const checkboxGroupId = 'grp_direct_ticks';

    const checkboxField = (externalId: string, positionY: number, optionValue: string) => ({
      type: FieldType.CHECKBOX,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      groupId: checkboxGroupId,
      externalId,
      fieldMeta: { type: 'checkbox', required: true, values: [option(1, optionValue)] },
    });

    const { envelope, directLink } = await apiSeedDirectTemplate(request, {
      title: '[TEST] Direct template with three grouped checkboxes',
      recipients: [
        { email: 'direct-ticks-recipient@documenso.com', name: 'Direct Ticks Recipient', role: 'SIGNER' as const },
      ],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          checkboxField('checkbox-a', 10, 'A1'),
          checkboxField('checkbox-b', 25, 'B1'),
          checkboxField('checkbox-c', 40, 'C1'),
        ],
      ],
    });

    const { fields } = envelope;

    const signatureField = findFieldByType(fields, FieldType.SIGNATURE);
    const checkboxA = findFieldByExternalId(fields, 'checkbox-a');
    const checkboxB = findFieldByExternalId(fields, 'checkbox-b');
    const checkboxC = findFieldByExternalId(fields, 'checkbox-c');

    const expectTickedFields = async (tickedFields: Array<{ id: number }>) => {
      await expect(async () => {
        for (const field of [checkboxA, checkboxB, checkboxC]) {
          const checkedIndices = await getKonvaCheckedCheckboxIndices(page, 1, field.id);
          const isExpectedTicked = tickedFields.some((tickedField) => tickedField.id === field.id);

          expect(checkedIndices, `Field ${field.externalId}`).toEqual(isExpectedTicked ? [0] : []);
        }
      }).toPass({ timeout: 10_000 });
    };

    const canvas = await openSigningPage(page, `/d/${directLink.token}`);

    await setupTypedSignature(page);
    await clickSigningField(canvas, signatureField);

    // "Next Field" is deliberately not pressed. It redraws every field on each change,
    // which hides a field acting on an out of date copy of its group.
    await clickKonvaFieldOption(page, 1, checkboxA.id, { type: 'checkbox', index: 0 });
    await expectTickedFields([checkboxA]);

    await clickKonvaFieldOption(page, 1, checkboxB.id, { type: 'checkbox', index: 0 });
    await expectTickedFields([checkboxA, checkboxB]);

    await clickKonvaFieldOption(page, 1, checkboxC.id, { type: 'checkbox', index: 0 });
    await expectTickedFields([checkboxA, checkboxB, checkboxC]);

    await clickKonvaFieldOption(page, 1, checkboxA.id, { type: 'checkbox', index: 0 });
    await expectTickedFields([checkboxB, checkboxC]);

    await completeSigning(page, { name: 'Direct Signer', email: 'direct-ticks-signer@test.documenso.com' });

    await page.waitForURL(/\/sign\/.+\/complete/);

    await expect(async () => {
      const createdDocument = await prisma.envelope.findFirstOrThrow({
        where: {
          type: 'DOCUMENT',
          templateId: mapSecondaryIdToTemplateId(envelope.secondaryId),
        },
        include: { fields: true },
        orderBy: { createdAt: 'desc' },
      });

      const customTextByExternalId = Object.fromEntries(
        createdDocument.fields
          .filter((field) => field.groupId === checkboxGroupId)
          .map((field) => [field.externalId, field.customText]),
      );

      expect(customTextByExternalId).toEqual({
        'checkbox-a': '',
        'checkbox-b': '[0]',
        'checkbox-c': '[0]',
      });
    }).toPass();
  });

  test('direct template signing auto inserts pre-checked options across a checkbox group', async ({
    page,
    request,
  }) => {
    const checkboxGroupId = 'grp_direct_prechecked';
    const atLeastTwo = { validationRule: 'Select at least', validationLength: 2 };

    const prechecked = (externalId: string, positionY: number, value: string) => ({
      type: FieldType.CHECKBOX,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      groupId: checkboxGroupId,
      externalId,
      fieldMeta: { type: 'checkbox', required: true, values: [option(1, value, true)], ...atLeastTwo },
    });

    const { directLink } = await apiSeedDirectTemplate(request, {
      title: '[TEST] Direct template with a pre-checked checkbox group',
      recipients: [
        { email: 'direct-prechecked-recipient@documenso.com', name: 'Direct Prechecked Recipient', role: 'SIGNER' },
      ],
      fieldsPerRecipient: [[SIGNATURE_FIELD, prechecked('checkbox-a', 10, 'A1'), prechecked('checkbox-b', 25, 'B1')]],
    });

    await openSigningPage(page, `/d/${directLink.token}`);

    // Each field has one pre-checked option, which meets "at least 2" across the group but
    // not on either field alone, so only the signature is left.
    await expectFieldsRemaining(page, 1);
  });

  test('document tabs count every field in a group', async ({ page, request }) => {
    const textMeta = { type: 'text', required: true, label: 'Company' };

    const { envelope, token } = await apiSeedDraftDocument(request, {
      recipients: [{ email: `group-tabs-${Date.now()}@test.documenso.com`, name: 'Tab Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 20,
            ...FIELD_SIZE,
            groupId: 'grp_tabs',
            externalId: 'text-a',
            fieldMeta: textMeta,
          },
        ],
      ],
    });

    await apiCreateEnvelopeItem(request, token, envelope.id, 'second-document.pdf');

    const [firstItem, secondItem] = (await apiGetEnvelope(request, token, envelope.id)).envelopeItems;
    const recipientId = envelope.recipients[0].id;

    // The second document has two more fields in the group and an ungrouped field.
    await apiCreateFields(request, token, envelope.id, [
      {
        recipientId,
        envelopeItemId: secondItem.id,
        type: FieldType.TEXT,
        page: 1,
        positionX: 5,
        positionY: 20,
        ...FIELD_SIZE,
        groupId: 'grp_tabs',
        externalId: 'text-b',
        fieldMeta: textMeta,
      },
      {
        recipientId,
        envelopeItemId: secondItem.id,
        type: FieldType.TEXT,
        page: 1,
        positionX: 5,
        positionY: 40,
        ...FIELD_SIZE,
        groupId: 'grp_tabs',
        externalId: 'text-c',
        fieldMeta: textMeta,
      },
      {
        recipientId,
        envelopeItemId: secondItem.id,
        type: FieldType.TEXT,
        page: 1,
        positionX: 5,
        positionY: 60,
        ...FIELD_SIZE,
        externalId: 'text-ungrouped',
        fieldMeta: { ...textMeta, label: 'Notes' },
      },
    ]);

    const { recipients } = await apiDistributeEnvelope(request, token, envelope.id);
    const { fields } = await apiGetEnvelope(request, token, envelope.id);

    const canvas = await openSigningPage(page, `/sign/${recipients[0].token}`);

    const firstTab = page.getByTitle(firstItem.title);
    const secondTab = page.getByTitle(secondItem.title);

    // Signature and one group field on the first document, two group fields and the
    // ungrouped field on the second.
    await expect(firstTab).toContainText('2 Fields');
    await expect(secondTab).toContainText('3 Fields');

    // Filling the group removes it from both tabs.
    await clickSigningField(canvas, findFieldByExternalId(fields, 'text-a'));
    await page.getByRole('dialog').locator('textarea').fill('Acme Inc');
    await page.getByRole('button', { name: 'Enter' }).click();

    await expect(firstTab).toContainText('1 Field');
    await expect(secondTab).toContainText('1 Field');
  });
});
