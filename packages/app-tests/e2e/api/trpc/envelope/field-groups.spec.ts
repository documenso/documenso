import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TCheckboxFieldMeta } from '@documenso/lib/types/field-meta';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import {
  apiCreateFields,
  apiCreateTestContext,
  apiGetEnvelope,
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

    // Updating the rule on one member syncs it to the sibling and returns both.
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

    expect(updatedFields.map((field) => field.id).sort()).toEqual([checkboxA.id, checkboxB.id].sort());

    for (const field of updatedFields) {
      expect(field.fieldMeta.validationLength).toBe(1);
      expect(field.fieldMeta.required).toBe(true);
    }

    // Deleting a member which leaves the group unable to satisfy its rule is rejected.
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
  });

  test('distribution validates groups and auto inserts pre-checked pools', async ({ request }) => {
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
        ],
      ],
    });

    const { fields } = envelope;
    const checkboxC = findFieldByExternalId(fields, 'checkbox-c');

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

    // Two pre-checked options across the group satisfy "at least 2", so every member is inserted.
    const insertedFields = await prisma.field.findMany({
      where: { envelopeId: envelope.id, groupId: 'grp_checkbox' },
      orderBy: { positionY: 'asc' },
    });

    expect(insertedFields.every((field) => field.inserted)).toBe(true);
    expect(insertedFields.map((field) => field.customText)).toEqual(['[0]', '[0]', '']);
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

    // Multiple fields may only be signed together when they form a checkbox group.
    const crossGroupResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldValues: [
        { fieldId: textA.id, fieldValue: { type: FieldType.TEXT, value: 'A' } },
        { fieldId: checkboxA.id, fieldValue: { type: FieldType.CHECKBOX, value: [0] } },
      ],
    });

    expect(crossGroupResponse.ok()).toBeFalsy();

    // Signing one member of a shared value group returns every member of the group.
    const textSignResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldValues: [{ fieldId: textA.id, fieldValue: { type: FieldType.TEXT, value: 'Acme Inc' } }],
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
      fieldValues: [{ fieldId: signatureField.id, fieldValue: { type: FieldType.SIGNATURE, value: 'Signature' } }],
    });

    // The checkbox group has not been answered yet.
    const unsignedCompleteResponse = await postTrpc(request, 'recipient.completeDocumentWithToken', {
      token: recipientToken,
      documentId,
    });

    await expectTrpcErrorCode(unsignedCompleteResponse, AppErrorCode.RECIPIENT_HAS_UNSIGNED_FIELDS);

    // A single tick is accepted but the pooled rule is not satisfied.
    const singleTickResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldValues: [{ fieldId: checkboxA.id, fieldValue: { type: FieldType.CHECKBOX, value: [0] } }],
    });

    expect(singleTickResponse.ok(), await singleTickResponse.text()).toBeTruthy();

    const invalidCompleteResponse = await postTrpc(request, 'recipient.completeDocumentWithToken', {
      token: recipientToken,
      documentId,
    });

    await expectTrpcErrorCode(invalidCompleteResponse, AppErrorCode.RECIPIENT_HAS_INVALID_FIELDS);

    // Ticking the sibling satisfies the rule and completion succeeds.
    const secondTickResponse = await postTrpc(request, 'envelope.field.sign', {
      token: recipientToken,
      fieldValues: [{ fieldId: checkboxB.id, fieldValue: { type: FieldType.CHECKBOX, value: [0] } }],
    });

    expect(secondTickResponse.ok(), await secondTickResponse.text()).toBeTruthy();

    const completeResponse = await postTrpc(request, 'recipient.completeDocumentWithToken', {
      token: recipientToken,
      documentId,
    });

    expect(completeResponse.ok(), await completeResponse.text()).toBeTruthy();
  });

  test('documents created from a template carry group settings and share prefilled values', async ({ request }) => {
    const { envelope, token } = await apiSeedTemplate(request, {
      recipients: [{ email: 'template-group@test.documenso.com', name: 'Template Signer' }],
      fieldsPerRecipient: [
        [
          SIGNATURE_FIELD,
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 10,
            ...FIELD_SIZE,
            groupId: 'grp_template_text',
            externalId: 'template-text-a',
            fieldMeta: { type: 'text', required: true, label: 'Company' },
          },
          {
            type: FieldType.TEXT,
            page: 1,
            positionX: 5,
            positionY: 20,
            ...FIELD_SIZE,
            groupId: 'grp_template_text',
            externalId: 'template-text-b',
            fieldMeta: { type: 'text', required: true, label: 'Company' },
          },
        ],
      ],
    });

    const templateTextA = findFieldByExternalId(envelope.fields, 'template-text-a');

    const formData = new FormData();

    formData.append(
      'payload',
      JSON.stringify({
        envelopeId: envelope.id,
        recipients: envelope.recipients.map((recipient) => ({ id: recipient.id, email: recipient.email })),
        // Prefilling one member of a shared value group prefills the whole group.
        prefillFields: [{ id: templateTextA.id, type: 'text', label: 'Employer', value: 'Acme Inc' }],
      }),
    );

    const useResponse = await request.post(`${API_BASE_URL}/envelope/use`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });

    expect(useResponse.ok(), await useResponse.text()).toBeTruthy();

    const { id: documentId } = (await useResponse.json()) as { id: string };

    const document = await apiGetEnvelope(request, token, documentId);

    const textA = findFieldByExternalId(document.fields, 'template-text-a');
    const textB = findFieldByExternalId(document.fields, 'template-text-b');

    expect(textA.groupId).toBe('grp_template_text');
    expect(textB.groupId).toBe('grp_template_text');

    for (const field of [textA, textB]) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const fieldMeta = field.fieldMeta as Record<string, unknown> | null;

      expect(fieldMeta?.label).toBe('Employer');
      expect(fieldMeta?.text).toBe('Acme Inc');
    }
  });
});
