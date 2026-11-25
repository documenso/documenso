import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TCheckboxFieldMeta, TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { SignatureLevel } from '@documenso/lib/types/signature-level';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { FieldType, SendStatus } from '@prisma/client';

import {
  apiCreateEnvelopeItem,
  apiCreateFields,
  apiCreateTestContext,
  apiDistributeEnvelope,
  apiGetEnvelope,
  apiSeedDirectTemplate,
  apiSeedDraftDocument,
  apiSeedPendingDocument,
  apiSeedTemplate,
} from '../../../fixtures/api-seeds';
import { WEBAPP_ORIGIN_HEADERS } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const API_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;

const FIELD_SIZE = { width: 20, height: 5 };

const SIGNATURE_FIELD = { type: FieldType.SIGNATURE, page: 1, positionX: 60, positionY: 5, ...FIELD_SIZE };

const option = (id: number, value: string, checked = false) => ({ id, checked, value });

const atLeastTwo = { validationRule: 'Select at least', validationLength: 2 };

const checkboxMeta = (
  values: TCheckboxFieldMeta['values'],
  overrides: Partial<TCheckboxFieldMeta> = {},
): TCheckboxFieldMeta => ({
  type: 'checkbox',
  direction: 'vertical',
  values,
  ...overrides,
});

const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const postApi = async (request: APIRequestContext, token: string, path: string, data: unknown) => {
  return await request.post(`${API_BASE_URL}${path}`, {
    headers: authHeader(token),
    data,
  });
};

const postTrpc = async (request: APIRequestContext, procedure: string, json: unknown) => {
  return await request.post(`${WEBAPP_BASE_URL}/api/trpc/${procedure}`, {
    headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
    data: JSON.stringify({ json }),
  });
};

const expectTrpcErrorCode = async (response: Awaited<ReturnType<APIRequestContext['post']>>, code: string) => {
  expect(response.ok()).toBeFalsy();

  const body = await response.json();

  expect(JSON.stringify(body)).toContain(code);
};

const findFieldByExternalId = <T extends { externalId?: string | null }>(fields: T[], externalId: string): T => {
  const field = fields.find((field) => field.externalId === externalId);

  if (!field) {
    throw new Error(`Field with external ID ${externalId} not found`);
  }

  return field;
};

const FILE_GROUP_ID = 'grp_files';

/**
 * Seeds a draft with one single-option checkbox per file, all in one group with the rule
 * "at least 2". The rule can only be satisfied while two or more files remain.
 */
const seedGroupAcrossFiles = async (request: APIRequestContext, fileCount: number) => {
  const { envelope, token } = await apiSeedDraftDocument(request, {
    recipients: [{ email: `group-files-${Date.now()}@test.documenso.com`, name: 'Files Signer' }],
    fieldsPerRecipient: [[SIGNATURE_FIELD]],
  });

  for (let fileNumber = 2; fileNumber <= fileCount; fileNumber += 1) {
    await apiCreateEnvelopeItem(request, token, envelope.id, `document-${fileNumber}.pdf`);
  }

  const { envelopeItems } = await apiGetEnvelope(request, token, envelope.id);

  await apiCreateFields(
    request,
    token,
    envelope.id,
    envelopeItems.map((envelopeItem, index) => ({
      recipientId: envelope.recipients[0].id,
      envelopeItemId: envelopeItem.id,
      type: FieldType.CHECKBOX,
      page: 1,
      positionX: 5,
      positionY: 20,
      ...FIELD_SIZE,
      groupId: FILE_GROUP_ID,
      externalId: `checkbox-file-${index + 1}`,
      fieldMeta: { type: 'checkbox', required: true, values: [option(1, `Option ${index + 1}`)], ...atLeastTwo },
    })),
  );

  return { envelope, token, envelopeItems };
};

const expectRuleRemovedFromFirstFile = async (envelopeId: string) => {
  const remainingFields = await prisma.field.findMany({ where: { envelopeId, groupId: FILE_GROUP_ID } });

  expect(remainingFields.map((field) => field.externalId)).toEqual(['checkbox-file-1']);
  expect(remainingFields[0].fieldMeta).not.toHaveProperty('validationRule');
  expect(remainingFields[0].fieldMeta).not.toHaveProperty('validationLength');
};

test.describe('[ENVELOPE_FIELD_GROUPS]', () => {
  test('create and update validation', async ({ request }) => {
    const { envelope, token } = await apiSeedDraftDocument(request, {
      recipients: [
        { email: 'group-api-one@test.documenso.com', name: 'Recipient One' },
        { email: 'group-api-two@test.documenso.com', name: 'Recipient Two' },
      ],
      fieldsPerRecipient: [[SIGNATURE_FIELD], [SIGNATURE_FIELD]],
    });

    const [recipientOne, recipientTwo] = envelope.recipients;
    const envelopeItemId = envelope.envelopeItems[0].id;

    const createFields = async (fields: Array<Record<string, unknown>>) =>
      await postApi(request, token, '/envelope/field/create-many', {
        envelopeId: envelope.id,
        data: fields.map((field) => ({ envelopeItemId, page: 1, ...FIELD_SIZE, ...field })),
      });

    // Signature, date and initials fields cannot be grouped.
    for (const type of [FieldType.SIGNATURE, FieldType.DATE, FieldType.INITIALS]) {
      const response = await createFields([
        { recipientId: recipientOne.id, type, positionX: 5, positionY: 10, groupId: 'grp_not_allowed' },
      ]);

      expect(response.ok(), `${type} should not be groupable`).toBeFalsy();
    }

    // A blank group ID is rejected rather than stored, since it would read as grouped in
    // some checks and ungrouped in others.
    for (const groupId of ['', '   ']) {
      const response = await createFields([
        { recipientId: recipientOne.id, type: FieldType.TEXT, positionX: 5, positionY: 10, groupId },
      ]);

      expect(response.status(), `groupId ${JSON.stringify(groupId)} should be rejected`).toBe(400);
    }

    // Groups cannot span recipients.
    const crossRecipientResponse = await createFields([
      { recipientId: recipientOne.id, type: FieldType.TEXT, positionX: 5, positionY: 10, groupId: 'grp_cross' },
      { recipientId: recipientTwo.id, type: FieldType.TEXT, positionX: 5, positionY: 20, groupId: 'grp_cross' },
    ]);

    expect(crossRecipientResponse.ok()).toBeFalsy();

    // Groups cannot mix field types.
    const mixedTypeResponse = await createFields([
      { recipientId: recipientOne.id, type: FieldType.TEXT, positionX: 5, positionY: 10, groupId: 'grp_mixed' },
      { recipientId: recipientOne.id, type: FieldType.NUMBER, positionX: 5, positionY: 20, groupId: 'grp_mixed' },
    ]);

    expect(mixedTypeResponse.ok()).toBeFalsy();

    // Settings which are not set match however they are sent. A field without any settings is
    // given defaults such as an empty label, which is the same as the other field having none.
    const unsetSettingsResponse = await createFields([
      { recipientId: recipientOne.id, type: FieldType.TEXT, positionX: 5, positionY: 60, groupId: 'grp_unset' },
      {
        recipientId: recipientOne.id,
        type: FieldType.TEXT,
        positionX: 5,
        positionY: 70,
        groupId: 'grp_unset',
        fieldMeta: { type: 'text', fontSize: 10 },
      },
    ]);

    expect(unsetSettingsResponse.ok(), await unsetSettingsResponse.text()).toBeTruthy();

    // A setting which is set on one field only still has to match, and is the one named.
    const setOnOneFieldResponse = await createFields([
      {
        recipientId: recipientOne.id,
        type: FieldType.TEXT,
        positionX: 5,
        positionY: 80,
        groupId: 'grp_unset',
        fieldMeta: { type: 'text', required: true },
      },
    ]);

    expect(setOnOneFieldResponse.status()).toBe(400);
    // Not followed by a comma, so no other setting is named with it.
    expect(await setOnOneFieldResponse.text()).toMatch(/fields in the group: required(?!,)/);

    // A valid checkbox group with a shared rule.
    await apiCreateFields(
      request,
      token,
      envelope.id,
      ['checkbox-a', 'checkbox-b'].map((externalId, index) => ({
        recipientId: recipientOne.id,
        envelopeItemId,
        type: FieldType.CHECKBOX,
        page: 1,
        positionX: 5,
        positionY: 10 + index * 15,
        ...FIELD_SIZE,
        groupId: 'grp_checkbox',
        externalId,
        fieldMeta: { type: 'checkbox', values: [option(1, `${externalId}-1`)], ...atLeastTwo },
      })),
    );

    const { fields } = await apiGetEnvelope(request, token, envelope.id);
    const checkboxA = findFieldByExternalId(fields, 'checkbox-a');
    const checkboxB = findFieldByExternalId(fields, 'checkbox-b');

    // Changing the type of a grouped field is rejected.
    const changeTypeResponse = await postApi(request, token, '/envelope/field/update-many', {
      envelopeId: envelope.id,
      data: [{ id: checkboxA.id, type: FieldType.TEXT, fieldMeta: { type: 'text' } }],
    });

    expect(changeTypeResponse.ok()).toBeFalsy();

    // Updating the rule on one field syncs it to the sibling, and returns only the field sent.
    const updateResponse = await postApi(request, token, '/envelope/field/update-many', {
      envelopeId: envelope.id,
      data: [
        {
          id: checkboxA.id,
          type: FieldType.CHECKBOX,
          fieldMeta: {
            type: 'checkbox',
            required: true,
            values: [option(1, 'checkbox-a-1')],
            validationRule: 'Select at least',
            validationLength: 1,
          },
        },
      ],
    });

    expect(updateResponse.ok(), await updateResponse.text()).toBeTruthy();

    const { data: updatedFields } = (await updateResponse.json()) as {
      data: Array<{ id: number; fieldMeta: Record<string, unknown> }>;
    };

    expect(updatedFields.map((field) => field.id)).toEqual([checkboxA.id]);

    const syncedSibling = await prisma.field.findUniqueOrThrow({ where: { id: checkboxB.id } });

    expect(syncedSibling.fieldMeta).toMatchObject({ validationLength: 1, required: true });

    // Deleting a field which leaves the group unable to satisfy its rule is rejected.
    const restoreRuleResponse = await postApi(request, token, '/envelope/field/update-many', {
      envelopeId: envelope.id,
      data: [
        {
          id: checkboxA.id,
          type: FieldType.CHECKBOX,
          fieldMeta: { type: 'checkbox', required: true, values: [option(1, 'checkbox-a-1')], ...atLeastTwo },
        },
      ],
    });

    expect(restoreRuleResponse.ok()).toBeTruthy();

    const deleteResponse = await postApi(request, token, '/envelope/field/delete', { fieldId: checkboxB.id });

    expect(deleteResponse.ok()).toBeFalsy();

    // The deprecated document route must not be a way around it, so it refuses grouped fields.
    const legacyDeleteResponse = await postApi(request, token, '/document/field/delete', { fieldId: checkboxB.id });

    expect(legacyDeleteResponse.ok()).toBeFalsy();
    expect(await legacyDeleteResponse.text()).toContain('/envelope/field/delete');
    expect(await prisma.field.count({ where: { id: checkboxB.id } })).toBe(1);
  });

  test('a field cannot be put into the group of another recipient by saving it under that recipient', async ({
    request,
  }) => {
    const radioField = (externalId: string, positionY: number, groupId?: string) => ({
      type: FieldType.RADIO,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      groupId,
      externalId,
      fieldMeta: { type: 'radio', values: [option(1, externalId)] },
    });

    const { envelope, user, team } = await apiSeedDraftDocument(request, {
      recipients: [
        { email: 'group-owner-one@test.documenso.com', name: 'Recipient One' },
        { email: 'group-owner-two@test.documenso.com', name: 'Recipient Two' },
      ],
      fieldsPerRecipient: [
        [SIGNATURE_FIELD, radioField('radio-one', 20)],
        [SIGNATURE_FIELD, radioField('radio-two-a', 35, 'grp_two'), radioField('radio-two-b', 50, 'grp_two')],
      ],
    });

    const recipientTwo = envelope.recipients[1];
    const radioOne = findFieldByExternalId(envelope.fields, 'radio-one');

    const saveFields = async (overrides: { recipientId?: number; groupId?: string } = {}) =>
      await setFieldsForDocument({
        userId: user.id,
        teamId: team.id,
        id: { type: 'envelopeId', id: envelope.id },
        fields: envelope.fields.map((field) => ({
          id: field.id,
          envelopeItemId: field.envelopeItemId,
          type: field.type,
          recipientId: field.recipientId,
          pageNumber: field.page,
          pageX: Number(field.positionX),
          pageY: Number(field.positionY),
          pageWidth: Number(field.width),
          pageHeight: Number(field.height),
          fieldMeta: field.fieldMeta ?? undefined,
          ...(field.id === radioOne.id ? overrides : {}),
        })),
        requestMetadata: { requestMetadata: {}, source: 'app', auth: 'session' },
      });

    // The group would look valid for recipient two, while the stored field stays with recipient one.
    await expect(saveFields({ recipientId: recipientTwo.id, groupId: 'grp_two' })).rejects.toThrow(
      /recipient or envelope item/,
    );

    const storedRadioOne = await prisma.field.findUniqueOrThrow({ where: { id: radioOne.id } });

    expect(storedRadioOne.groupId).toBeNull();
    expect(storedRadioOne.recipientId).toBe(radioOne.recipientId);

    // The same payload without the move is accepted, so only the move caused the rejection.
    const { fields: savedFields } = await saveFields();

    expect(savedFields).toHaveLength(envelope.fields.length);
  });

  test('set fields validates ungrouped field meta and checks grouped checkbox rules across the group', async ({
    request,
  }) => {
    const { envelope, user, team } = await apiSeedDraftDocument(request, {
      recipients: [{ email: 'set-fields-meta@test.documenso.com', name: 'Set Fields Signer' }],
      fieldsPerRecipient: [[SIGNATURE_FIELD]],
    });

    const saveFields = async (fields: { type: FieldType; fieldMeta: TFieldMetaSchema; groupId?: string }[]) =>
      await setFieldsForDocument({
        userId: user.id,
        teamId: team.id,
        id: { type: 'envelopeId', id: envelope.id },
        fields: fields.map((field, index) => ({
          ...field,
          envelopeItemId: envelope.envelopeItems[0].id,
          recipientId: envelope.recipients[0].id,
          pageNumber: 1,
          pageX: 5,
          pageY: 10 + index * 10,
          pageWidth: FIELD_SIZE.width,
          pageHeight: FIELD_SIZE.height,
        })),
        requestMetadata: { requestMetadata: {}, source: 'app', auth: 'session' },
      });

    const groupedCheckbox = (value: string) => ({
      type: FieldType.CHECKBOX,
      groupId: 'grp_set_fields',
      fieldMeta: checkboxMeta([option(1, value)], atLeastTwo),
    });

    await expect(
      saveFields([
        { type: FieldType.TEXT, fieldMeta: { type: 'text', text: 'Fixed', required: true, readOnly: true } },
      ]),
    ).rejects.toThrow(/cannot be both read-only and required/);

    await expect(saveFields([{ type: FieldType.TEXT, fieldMeta: checkboxMeta([option(1, 'A1')]) }])).rejects.toThrow(
      /does not match the field type/,
    );

    // Each grouped checkbox holds a single option, so "at least 2" can only be met across the group.
    await expect(saveFields([groupedCheckbox('A1')])).rejects.toThrow(/at least 2 options/);

    const { fields } = await saveFields([groupedCheckbox('A1'), groupedCheckbox('B1')]);

    expect(fields).toHaveLength(2);
  });

  test('set fields rejects a field listed twice without changing it', async ({ request }) => {
    const groupedCheckbox = (externalId: string, positionY: number) => ({
      type: FieldType.CHECKBOX,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      groupId: 'grp_listed_twice',
      externalId,
      fieldMeta: checkboxMeta([option(1, externalId)], { required: true, ...atLeastTwo }),
    });

    const { envelope, user, team } = await apiSeedDraftDocument(request, {
      recipients: [{ email: 'listed-twice@test.documenso.com', name: 'Listed Twice Signer' }],
      fieldsPerRecipient: [[SIGNATURE_FIELD, groupedCheckbox('checkbox-a', 20), groupedCheckbox('checkbox-b', 35)]],
    });

    const toFieldData = (field: (typeof envelope.fields)[number]) => ({
      id: field.id,
      envelopeItemId: field.envelopeItemId,
      type: field.type,
      recipientId: field.recipientId,
      pageNumber: field.page,
      pageX: Number(field.positionX),
      pageY: Number(field.positionY),
      pageWidth: Number(field.width),
      pageHeight: Number(field.height),
      fieldMeta: field.fieldMeta ?? undefined,
    });

    const checkboxA = findFieldByExternalId(envelope.fields, 'checkbox-a');

    const ungroupedCheckboxA = {
      ...toFieldData(checkboxA),
      groupId: null,
      fieldMeta: checkboxMeta([option(1, 'checkbox-a')]),
    };

    // The first entry keeps checkbox A in its group, which is what lets "at least 2" pass. The
    // second takes it out, and is the one which would be stored.
    await expect(
      setFieldsForDocument({
        userId: user.id,
        teamId: team.id,
        id: { type: 'envelopeId', id: envelope.id },
        fields: [...envelope.fields.map(toFieldData), ungroupedCheckboxA],
        requestMetadata: { requestMetadata: {}, source: 'app', auth: 'session' },
      }),
    ).rejects.toThrow(/listed more than once/);

    const storedCheckboxA = await prisma.field.findUniqueOrThrow({
      where: {
        id: checkboxA.id,
      },
    });

    expect(storedCheckboxA.groupId).toBe('grp_listed_twice');
  });

  test('deleting a file removes a group rule which can no longer be satisfied', async ({ request }) => {
    const { envelope, token, envelopeItems } = await seedGroupAcrossFiles(request, 2);

    const deleteItemResponse = await postApi(request, token, '/envelope/item/delete', {
      envelopeId: envelope.id,
      envelopeItemId: envelopeItems[1].id,
    });

    expect(deleteItemResponse.ok(), await deleteItemResponse.text()).toBeTruthy();

    await expectRuleRemovedFromFirstFile(envelope.id);

    // Distribution validates every group, so it only succeeds once the group is valid again.
    await apiDistributeEnvelope(request, token, envelope.id);
  });

  test('distribution validates groups and auto inserts groups with pre-checked options', async ({ request }) => {
    const ctx = await apiCreateTestContext('e2e-field-groups-distribute');

    const { envelope, token } = await apiSeedDraftDocument(request, {
      context: ctx,
      recipients: [{ email: 'group-distribute@test.documenso.com', name: 'Distribute Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 10,
            ...FIELD_SIZE,
            groupId: 'grp_checkbox',
            externalId: 'checkbox-a',
            fieldMeta: { type: 'checkbox', values: [option(1, 'A1', true)], ...atLeastTwo },
          },
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 25,
            ...FIELD_SIZE,
            groupId: 'grp_checkbox',
            externalId: 'checkbox-b',
            fieldMeta: { type: 'checkbox', values: [option(1, 'B1', true)], ...atLeastTwo },
          },
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 40,
            ...FIELD_SIZE,
            groupId: 'grp_checkbox',
            externalId: 'checkbox-c',
            fieldMeta: { type: 'checkbox', values: [option(1, 'C1')], ...atLeastTwo },
          },
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 50,
            positionY: 10,
            ...FIELD_SIZE,
            externalId: 'checkbox-ungrouped',
            fieldMeta: { type: 'checkbox', values: [option(1, 'U1', true), option(2, 'U2')], ...atLeastTwo },
          },
          {
            type: FieldType.RADIO,
            page: 1,
            positionX: 50,
            positionY: 25,
            ...FIELD_SIZE,
            externalId: 'radio-ungrouped',
            fieldMeta: { type: 'radio', values: [option(1, 'R1'), option(2, 'R2', true)] },
          },
        ],
      ],
    });

    const { fields } = envelope;
    const checkboxC = findFieldByExternalId(fields, 'checkbox-c');
    const ungroupedCheckbox = findFieldByExternalId(fields, 'checkbox-ungrouped');
    const ungroupedRadio = findFieldByExternalId(fields, 'radio-ungrouped');

    // Put the group in a state the editor would never produce, so distribution has to catch it.
    await prisma.field.update({
      where: { id: checkboxC.id },
      data: {
        fieldMeta: checkboxMeta([option(1, 'C1')], { validationRule: 'Select at least', validationLength: 5 }),
      },
    });

    const invalidResponse = await postApi(request, token, '/envelope/distribute', { envelopeId: envelope.id });

    expect(invalidResponse.ok()).toBeFalsy();

    await prisma.field.update({
      where: { id: checkboxC.id },
      data: { fieldMeta: checkboxMeta([option(1, 'C1')], atLeastTwo) },
    });

    const validResponse = await postApi(request, token, '/envelope/distribute', { envelopeId: envelope.id });

    expect(validResponse.ok(), await validResponse.text()).toBeTruthy();

    // Two pre-checked options across the group satisfy "at least 2", so every field is inserted.
    const insertedFields = await prisma.field.findMany({
      where: { envelopeId: envelope.id, groupId: 'grp_checkbox' },
      orderBy: { positionY: 'asc' },
    });

    expect(insertedFields.every((field) => field.inserted)).toBe(true);
    expect(insertedFields.map((field) => field.customText)).toEqual(['[0]', '[0]', '']);

    // Ungrouped fields are judged on their own. One pre-checked option does not meet the
    // checkbox's rule, while the pre-checked radio is inserted.
    const insertedUngroupedCheckbox = await prisma.field.findUniqueOrThrow({ where: { id: ungroupedCheckbox.id } });
    const insertedUngroupedRadio = await prisma.field.findUniqueOrThrow({ where: { id: ungroupedRadio.id } });

    expect(insertedUngroupedCheckbox.inserted).toBe(false);
    expect(insertedUngroupedRadio).toMatchObject({ inserted: true, customText: '1' });

    // Field settings are still checked when the document is sent again to a recipient who
    // already has it, and an unknown checkbox rule is rejected with nothing pre-checked.
    await prisma.recipient.updateMany({
      where: { envelopeId: envelope.id },
      data: { sendStatus: SendStatus.SENT },
    });

    await prisma.field.update({
      where: { id: ungroupedCheckbox.id },
      data: {
        fieldMeta: checkboxMeta([option(1, 'U1'), option(2, 'U2')], {
          validationRule: 'Select between',
          validationLength: 2,
        }),
      },
    });

    const resendResponse = await postApi(request, token, '/envelope/distribute', { envelopeId: envelope.id });

    expect(resendResponse.status(), await resendResponse.text()).toBe(400);
  });

  test('signing and completion treat a group as a single field', async ({ request }) => {
    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: 'group-sign@test.documenso.com', name: 'Group Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 10,
            ...FIELD_SIZE,
            groupId: 'grp_text',
            externalId: 'text-a',
            fieldMeta: { type: 'text', required: true },
          },
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 20,
            ...FIELD_SIZE,
            groupId: 'grp_text',
            externalId: 'text-b',
            fieldMeta: { type: 'text', required: true },
          },
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 35,
            ...FIELD_SIZE,
            groupId: 'grp_checkbox',
            externalId: 'checkbox-a',
            fieldMeta: { type: 'checkbox', required: true, values: [option(1, 'A1')], ...atLeastTwo },
          },
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 50,
            ...FIELD_SIZE,
            groupId: 'grp_checkbox',
            externalId: 'checkbox-b',
            fieldMeta: { type: 'checkbox', required: true, values: [option(1, 'B1')], ...atLeastTwo },
          },
        ],
      ],
    });

    const { fields } = envelope;
    const { token: recipientToken } = distributeResult.recipients[0];
    const documentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

    const signatureField = fields.find((field) => field.type === FieldType.SIGNATURE);
    const textA = findFieldByExternalId(fields, 'text-a');
    const textB = findFieldByExternalId(fields, 'text-b');
    const checkboxA = findFieldByExternalId(fields, 'checkbox-a');
    const checkboxB = findFieldByExternalId(fields, 'checkbox-b');

    if (!signatureField) {
      throw new Error('Signature field not found');
    }

    // Signing one field of a shared value group returns every field in the group.
    const textSignResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldId: textA.id,
      fieldValue: { type: FieldType.TEXT, value: 'Acme Inc' },
    });

    expect(textSignResponse.ok(), await textSignResponse.text()).toBeTruthy();

    const textSignBody = (await textSignResponse.json()) as {
      result: { data: { json: { signedFields: Array<{ id: number; customText: string }> } } };
    };

    const { signedFields } = textSignBody.result.data.json;

    expect(signedFields.map((field) => field.id).sort()).toEqual([textA.id, textB.id].sort());
    expect(signedFields.every((field) => field.customText === 'Acme Inc')).toBe(true);

    await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldId: signatureField.id,
      fieldValue: { type: FieldType.SIGNATURE, value: 'Signature' },
    });

    // The checkbox group has not been answered yet.
    const unsignedCompleteResponse = await postTrpc(request, 'recipient.completeDocumentWithToken', {
      token: recipientToken,
      documentId,
    });

    await expectTrpcErrorCode(unsignedCompleteResponse, AppErrorCode.RECIPIENT_HAS_UNSIGNED_FIELDS);

    // A single tick is accepted but the group's rule is not satisfied.
    const singleTickResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldId: checkboxA.id,
      fieldValue: { type: FieldType.CHECKBOX, value: [0] },
    });

    expect(singleTickResponse.ok(), await singleTickResponse.text()).toBeTruthy();

    const invalidCompleteResponse = await postTrpc(request, 'recipient.completeDocumentWithToken', {
      token: recipientToken,
      documentId,
    });

    await expectTrpcErrorCode(invalidCompleteResponse, AppErrorCode.RECIPIENT_HAS_UNSIGNED_FIELDS);

    // Ticking the sibling satisfies the rule and completion succeeds.
    const secondTickResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldId: checkboxB.id,
      fieldValue: { type: FieldType.CHECKBOX, value: [0] },
    });

    expect(secondTickResponse.ok(), await secondTickResponse.text()).toBeTruthy();

    const getLoggedFieldIds = async (type: string) => {
      const auditLogs = await prisma.documentAuditLog.findMany({ where: { envelopeId: envelope.id, type } });

      return auditLogs.map((auditLog) => (auditLog.data as { fieldId: string }).fieldId).sort();
    };

    // Each tick writes both checkbox fields, but only the ticked one changed, so each field
    // is logged once. Both text fields are logged, since both took the value.
    expect(await getLoggedFieldIds(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED)).toEqual(
      [textA, textB, signatureField, checkboxA, checkboxB].map((field) => field.secondaryId).sort(),
    );

    // Unticking A clears it while B keeps the group answered. A is logged as cleared.
    const untickResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldId: checkboxA.id,
      fieldValue: { type: FieldType.CHECKBOX, value: [] },
    });

    expect(untickResponse.ok(), await untickResponse.text()).toBeTruthy();
    expect(await getLoggedFieldIds(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED)).toEqual([checkboxA.secondaryId]);

    const retickResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldId: checkboxA.id,
      fieldValue: { type: FieldType.CHECKBOX, value: [0] },
    });

    expect(retickResponse.ok(), await retickResponse.text()).toBeTruthy();

    const completeResponse = await postTrpc(request, 'recipient.completeDocumentWithToken', {
      token: recipientToken,
      documentId,
    });

    expect(completeResponse.ok(), await completeResponse.text()).toBeTruthy();
  });

  test('signing an optional field with an empty value is logged as an insertion', async ({ request }) => {
    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: 'empty-value-sign@test.documenso.com', name: 'Empty Value Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 10,
            ...FIELD_SIZE,
            externalId: 'optional-text',
            fieldMeta: { type: 'text', required: false },
          },
        ],
      ],
    });

    const { token: recipientToken } = distributeResult.recipients[0];
    const textField = findFieldByExternalId(envelope.fields, 'optional-text');

    for (const value of ['Acme Inc', '']) {
      const response = await postTrpc(request, 'envelope.field.sign', {
        token: recipientToken,
        fieldId: textField.id,
        fieldValue: { type: FieldType.TEXT, value },
      });

      expect(response.ok(), await response.text()).toBeTruthy();
    }

    const storedField = await prisma.field.findUniqueOrThrow({ where: { id: textField.id } });

    expect(storedField.inserted).toBe(true);
    expect(storedField.customText).toBe('');

    const auditLogs = await prisma.documentAuditLog.findMany({
      where: {
        envelopeId: envelope.id,
        type: {
          in: [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED, DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(auditLogs.map((auditLog) => auditLog.type)).toEqual([
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
    ]);
  });

  test('a qualified signature envelope cannot be completed with a broken checkbox rule', async ({ request }) => {
    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: 'group-tsp@test.documenso.com', name: 'Group TSP Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 35,
            ...FIELD_SIZE,
            externalId: 'checkbox',
            fieldMeta: {
              type: 'checkbox',
              required: true,
              values: [option(1, 'A'), option(2, 'B'), option(3, 'C')],
              ...atLeastTwo,
            },
          },
        ],
      ],
    });

    // These envelopes are completed through the signing provider flow instead of the
    // usual completion, so they need their own check.
    await prisma.envelope.update({ where: { id: envelope.id }, data: { signatureLevel: SignatureLevel.QES } });

    const { token: recipientToken } = distributeResult.recipients[0];

    const signatureField = envelope.fields.find((field) => field.type === FieldType.SIGNATURE);
    const checkbox = findFieldByExternalId(envelope.fields, 'checkbox');

    if (!signatureField) {
      throw new Error('Signature field not found');
    }

    for (const [fieldId, fieldValue] of [
      [signatureField.id, { type: FieldType.SIGNATURE, value: 'Signature' }],
      [checkbox.id, { type: FieldType.CHECKBOX, value: [0] }],
    ] as const) {
      const signResponse = await postTrpc(request, 'envelope.field.sign', {
        token: recipientToken,
        fieldId,
        fieldValue,
      });

      expect(signResponse.ok(), await signResponse.text()).toBeTruthy();
    }

    const completeResponse = await postTrpc(request, 'recipient.completeDocumentWithToken', {
      token: recipientToken,
      documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
    });

    await expectTrpcErrorCode(completeResponse, AppErrorCode.RECIPIENT_HAS_UNSIGNED_FIELDS);
  });

  test('legacy token routes cannot sign or unsign a field of a V2 envelope', async ({ request }) => {
    const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
      recipients: [{ email: 'group-legacy@test.documenso.com', name: 'Group Legacy Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 10,
            ...FIELD_SIZE,
            groupId: 'grp_text',
            externalId: 'text-a',
            fieldMeta: { type: 'text', required: true },
          },
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 20,
            ...FIELD_SIZE,
            groupId: 'grp_text',
            externalId: 'text-b',
            fieldMeta: { type: 'text', required: true },
          },
        ],
      ],
    });

    const { token: recipientToken } = distributeResult.recipients[0];

    const textA = findFieldByExternalId(envelope.fields, 'text-a');
    const textB = findFieldByExternalId(envelope.fields, 'text-b');

    const getGroupFields = async () =>
      await prisma.field.findMany({
        where: { id: { in: [textA.id, textB.id] } },
        orderBy: { id: 'asc' },
        select: { inserted: true, customText: true },
      });

    // Signing one field through the legacy route would fill it without its sibling.
    const legacySignResponse = await postTrpc(request, 'field.signFieldWithToken', {
      token: recipientToken,
      fieldId: textA.id,
      value: 'Acme Inc',
      isBase64: false,
    });

    await expectTrpcErrorCode(legacySignResponse, AppErrorCode.INVALID_REQUEST);

    expect(await getGroupFields()).toEqual([
      { inserted: false, customText: '' },
      { inserted: false, customText: '' },
    ]);

    const signResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldId: textA.id,
      fieldValue: { type: FieldType.TEXT, value: 'Acme Inc' },
    });

    expect(signResponse.ok(), await signResponse.text()).toBeTruthy();

    // Unsigning one field through the legacy route would clear it without its sibling.
    const legacyRemoveResponse = await postTrpc(request, 'field.removeSignedFieldWithToken', {
      token: recipientToken,
      fieldId: textB.id,
    });

    await expectTrpcErrorCode(legacyRemoveResponse, AppErrorCode.INVALID_REQUEST);

    expect(await getGroupFields()).toEqual([
      { inserted: true, customText: 'Acme Inc' },
      { inserted: true, customText: 'Acme Inc' },
    ]);
  });

  test('documents created from a template carry group settings and reject prefills which leave a group out of sync', async ({
    request,
  }) => {
    const textField = (externalId: string, positionY: number) => ({
      type: FieldType.TEXT,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      groupId: 'grp_template_text',
      externalId,
      fieldMeta: { type: 'text', required: true, label: 'Company' },
    });

    const { envelope, token } = await apiSeedTemplate(request, {
      recipients: [{ email: 'template-group@test.documenso.com', name: 'Template Signer' }],
      fieldsPerRecipient: [[SIGNATURE_FIELD, textField('template-text-a', 10), textField('template-text-b', 20)]],
    });

    const templateTextA = findFieldByExternalId(envelope.fields, 'template-text-a');
    const templateTextB = findFieldByExternalId(envelope.fields, 'template-text-b');

    const useTemplate = async (prefillFields: Array<Record<string, unknown>>) => {
      const formData = new FormData();

      formData.append(
        'payload',
        JSON.stringify({
          envelopeId: envelope.id,
          recipients: envelope.recipients.map((recipient) => ({ id: recipient.id, email: recipient.email })),
          prefillFields,
        }),
      );

      return await request.post(`${API_BASE_URL}/envelope/use`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });
    };

    const prefill = (id: number, value: string) => ({ id, type: 'text', label: 'Employer', value });

    // A group acts as one field, so prefilling only some fields or giving them different
    // values leaves it out of sync and is rejected.
    const partialResponse = await useTemplate([prefill(templateTextA.id, 'Acme Inc')]);

    expect(partialResponse.status()).toBe(400);
    expect(await partialResponse.text()).toContain('must be identical for all fields in the group');

    const mismatchedResponse = await useTemplate([
      prefill(templateTextA.id, 'Acme Inc'),
      prefill(templateTextB.id, 'Other Inc'),
    ]);

    expect(mismatchedResponse.status()).toBe(400);

    const useResponse = await useTemplate([
      prefill(templateTextA.id, 'Acme Inc'),
      prefill(templateTextB.id, 'Acme Inc'),
    ]);

    expect(useResponse.ok(), await useResponse.text()).toBeTruthy();

    const { id: documentId } = (await useResponse.json()) as { id: string };

    const document = await apiGetEnvelope(request, token, documentId);

    for (const externalId of ['template-text-a', 'template-text-b']) {
      const field = findFieldByExternalId(document.fields, externalId);

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const fieldMeta = field.fieldMeta as Record<string, unknown> | null;

      expect(field.groupId).toBe('grp_template_text');
      expect(fieldMeta?.label).toBe('Employer');
      expect(fieldMeta?.text).toBe('Acme Inc');
    }
  });

  test('prefilled radio and checkbox fields replace the selection of their group', async ({ request }) => {
    const optionField = (
      type: FieldType,
      externalId: string,
      positionY: number,
      fieldMeta: Record<string, unknown>,
    ) => ({
      type,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      groupId: `grp_prefill_${type.toLowerCase()}`,
      externalId,
      fieldMeta,
    });

    const { envelope, token } = await apiSeedTemplate(request, {
      recipients: [{ email: 'template-option-prefill@test.documenso.com', name: 'Template Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          optionField(FieldType.RADIO, 'radio-a', 10, { type: 'radio', values: [option(1, 'A1'), option(2, 'A2')] }),
          optionField(FieldType.RADIO, 'radio-b', 20, { type: 'radio', values: [option(1, 'B1', true)] }),
          optionField(
            FieldType.CHECKBOX,
            'checkbox-a',
            30,
            checkboxMeta([option(1, 'A1'), option(2, 'A2')], atLeastTwo),
          ),
          optionField(FieldType.CHECKBOX, 'checkbox-b', 40, checkboxMeta([option(1, 'B1', true)], atLeastTwo)),
        ],
      ],
    });

    const useTemplate = async (checkboxValue: string[]) => {
      const formData = new FormData();

      formData.append(
        'payload',
        JSON.stringify({
          envelopeId: envelope.id,
          recipients: envelope.recipients.map((recipient) => ({ id: recipient.id, email: recipient.email })),
          distributeDocument: true,
          prefillFields: [
            { id: findFieldByExternalId(envelope.fields, 'radio-a').id, type: 'radio', value: 'A1' },
            { id: findFieldByExternalId(envelope.fields, 'checkbox-a').id, type: 'checkbox', value: checkboxValue },
          ],
        }),
      );

      return await request.post(`${API_BASE_URL}/envelope/use`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });
    };

    // The template pre-selects B in both groups. The prefills replace that, so only A is selected.
    const response = await useTemplate(['A1', 'A2']);

    expect(response.ok(), await response.text()).toBeTruthy();

    const { id: documentEnvelopeId } = (await response.json()) as { id: string };

    const documentFields = await prisma.field.findMany({
      where: { envelopeId: documentEnvelopeId, groupId: { not: null } },
      orderBy: { positionY: 'asc' },
    });

    expect(documentFields.map(({ inserted, customText }) => ({ inserted, customText }))).toEqual([
      { inserted: true, customText: '0' },
      { inserted: true, customText: '' },
      { inserted: true, customText: '[0,1]' },
      { inserted: true, customText: '' },
    ]);

    // One option is short of "at least 2" for the group, so the prefill is rejected.
    const invalidResponse = await useTemplate(['A1']);

    expect(invalidResponse.status(), await invalidResponse.text()).toBe(400);
  });

  test('prefilled values which leave a group invalid are rejected', async ({ request }) => {
    const radioField = (externalId: string, positionY: number, values: ReturnType<typeof option>[]) => ({
      type: FieldType.RADIO,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      groupId: 'grp_template_radio',
      externalId,
      fieldMeta: { type: 'radio', required: true, values },
    });

    const { envelope, token } = await apiSeedTemplate(request, {
      recipients: [{ email: 'template-radio-prefill@test.documenso.com', name: 'Template Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          radioField('radio-a', 10, [option(1, 'A1'), option(2, 'A2')]),
          radioField('radio-b', 20, [option(1, 'B1')]),
        ],
      ],
    });

    const radioA = findFieldByExternalId(envelope.fields, 'radio-a');
    const radioB = findFieldByExternalId(envelope.fields, 'radio-b');

    const formData = new FormData();

    formData.append(
      'payload',
      JSON.stringify({
        envelopeId: envelope.id,
        recipients: envelope.recipients.map((recipient) => ({ id: recipient.id, email: recipient.email })),
        // Selecting on both fields would give the group two selections.
        prefillFields: [
          { id: radioA.id, type: 'radio', value: 'A1' },
          { id: radioB.id, type: 'radio', value: 'B1' },
        ],
      }),
    );

    const useResponse = await request.post(`${API_BASE_URL}/envelope/use`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });

    expect(useResponse.status(), await useResponse.text()).toBe(400);
  });

  test('direct template fields of a shared value group must be submitted with the same value', async ({ request }) => {
    const textField = (externalId: string, positionY: number) => ({
      type: FieldType.TEXT,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      groupId: 'grp_direct_text',
      externalId,
      fieldMeta: { type: 'text', required: true, label: 'Company' },
    });

    const { envelope, directLink } = await apiSeedDirectTemplate(request, {
      fieldsPerRecipient: [[SIGNATURE_FIELD, textField('text-a', 10), textField('text-b', 20)]],
    });

    const { updatedAt } = await prisma.envelope.findUniqueOrThrow({ where: { id: envelope.id } });

    const signatureField = envelope.fields.find((field) => field.type === FieldType.SIGNATURE);
    const textA = findFieldByExternalId(envelope.fields, 'text-a');
    const textB = findFieldByExternalId(envelope.fields, 'text-b');

    const createDocument = async (textAValue: string, textBValue: string) =>
      await request.post(`${WEBAPP_BASE_URL}/api/trpc/template.createDocumentFromDirectTemplate`, {
        headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
        data: JSON.stringify({
          json: {
            directTemplateToken: directLink.token,
            directRecipientEmail: `direct-group-${Date.now()}@test.documenso.com`,
            templateUpdatedAt: updatedAt.toISOString(),
            signedFieldValues: [
              { token: '', fieldId: signatureField?.id, value: 'Direct Signer', isBase64: false },
              { token: '', fieldId: textA.id, value: textAValue, isBase64: false },
              { token: '', fieldId: textB.id, value: textBValue, isBase64: false },
            ],
          },
          meta: { values: { templateUpdatedAt: ['Date'] } },
        }),
      });

    // A blank field would be marked as inserted with no value, and a different value would
    // give the group two answers.
    expect((await createDocument('Acme Inc', '')).status()).toBe(400);
    expect((await createDocument('Acme Inc', 'Other Inc')).status()).toBe(400);

    const matchingResponse = await createDocument('Acme Inc', 'Acme Inc');

    expect(matchingResponse.ok(), await matchingResponse.text()).toBeTruthy();
  });

  test('direct template rejects a checkbox value which is not a list of its options', async ({ request }) => {
    const { envelope, directLink } = await apiSeedDirectTemplate(request, {
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.CHECKBOX,
            page: 1,
            positionX: 5,
            positionY: 10,
            ...FIELD_SIZE,
            externalId: 'checkbox-direct',
            fieldMeta: {
              type: 'checkbox',
              values: [option(1, 'A'), option(2, 'B')],
              validationRule: 'Select at least',
              validationLength: 1,
            },
          },
        ],
      ],
    });

    const { updatedAt } = await prisma.envelope.findUniqueOrThrow({ where: { id: envelope.id } });

    const signatureField = envelope.fields.find((field) => field.type === FieldType.SIGNATURE);
    const checkbox = findFieldByExternalId(envelope.fields, 'checkbox-direct');

    const createDocument = async (checkboxValue: string) =>
      await request.post(`${WEBAPP_BASE_URL}/api/trpc/template.createDocumentFromDirectTemplate`, {
        headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
        data: JSON.stringify({
          json: {
            directTemplateToken: directLink.token,
            directRecipientEmail: `direct-checkbox-${Date.now()}@test.documenso.com`,
            templateUpdatedAt: updatedAt.toISOString(),
            signedFieldValues: [
              { token: '', fieldId: signatureField?.id, value: 'Direct Signer', isBase64: false },
              { token: '', fieldId: checkbox.id, value: checkboxValue, isBase64: false },
            ],
          },
          meta: { values: { templateUpdatedAt: ['Date'] } },
        }),
      });

    // Not JSON, not a list, and an option which does not exist.
    expect((await createDocument('abc')).status()).toBe(400);
    expect((await createDocument('{"0":true}')).status()).toBe(400);
    expect((await createDocument('[5]')).status()).toBe(400);

    const validResponse = await createDocument('[0]');

    expect(validResponse.ok(), await validResponse.text()).toBeTruthy();
  });

  test('direct template radio groups accept a selection in only one field', async ({ request }) => {
    const radioField = (externalId: string, positionY: number, values: ReturnType<typeof option>[]) => ({
      type: FieldType.RADIO,
      page: 1,
      positionX: 5,
      positionY,
      ...FIELD_SIZE,
      groupId: 'grp_direct_radio',
      externalId,
      fieldMeta: { type: 'radio', required: true, values },
    });

    const { envelope, directLink } = await apiSeedDirectTemplate(request, {
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          radioField('radio-a', 10, [option(1, 'A1'), option(2, 'A2')]),
          radioField('radio-b', 20, [option(1, 'B1')]),
        ],
      ],
    });

    const { updatedAt } = await prisma.envelope.findUniqueOrThrow({ where: { id: envelope.id } });

    const signatureField = envelope.fields.find((field) => field.type === FieldType.SIGNATURE);
    const radioA = findFieldByExternalId(envelope.fields, 'radio-a');
    const radioB = findFieldByExternalId(envelope.fields, 'radio-b');

    const createDocument = async (radioAValue: string, radioBValue: string | undefined) =>
      await request.post(`${WEBAPP_BASE_URL}/api/trpc/template.createDocumentFromDirectTemplate`, {
        headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
        data: JSON.stringify({
          json: {
            directTemplateToken: directLink.token,
            directRecipientEmail: `direct-radio-${Date.now()}@test.documenso.com`,
            templateUpdatedAt: updatedAt.toISOString(),
            signedFieldValues: [
              { token: '', fieldId: signatureField?.id, value: 'Direct Signer', isBase64: false },
              { token: '', fieldId: radioA.id, value: radioAValue, isBase64: false },
              { token: '', fieldId: radioB.id, value: radioBValue, isBase64: false },
            ],
          },
          meta: { values: { templateUpdatedAt: ['Date'] } },
        }),
      });

    // Selecting in both fields would give a single choice group two answers.
    const doubleSelectionResponse = await createDocument('1', '0');

    expect(doubleSelectionResponse.status(), await doubleSelectionResponse.text()).toBe(400);

    const singleSelectionResponse = await createDocument('1', '');

    expect(singleSelectionResponse.ok(), await singleSelectionResponse.text()).toBeTruthy();

    // A field sent without a value has no selection, the same as one sent with an empty value.
    const omittedValueResponse = await createDocument('1', undefined);

    expect(omittedValueResponse.ok(), await omittedValueResponse.text()).toBeTruthy();
  });
});
