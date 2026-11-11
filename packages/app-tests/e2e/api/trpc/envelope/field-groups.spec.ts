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

    // Updating the rule on one field syncs it to the sibling and returns both.
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

    const completeResponse = await postTrpc(request, 'recipient.completeDocumentWithToken', {
      token: recipientToken,
      documentId,
    });

    expect(completeResponse.ok(), await completeResponse.text()).toBeTruthy();
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
          radioField('radio-b', 20, [option(1, 'B1', true)]),
        ],
      ],
    });

    const radioA = findFieldByExternalId(envelope.fields, 'radio-a');

    const formData = new FormData();

    formData.append(
      'payload',
      JSON.stringify({
        envelopeId: envelope.id,
        recipients: envelope.recipients.map((recipient) => ({ id: recipient.id, email: recipient.email })),
        // Selecting on A while B is already selected would give the group two selections.
        prefillFields: [{ id: radioA.id, type: 'radio', value: 'A1' }],
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

    const createDocument = async (radioAValue: string, radioBValue: string) =>
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
  });
});
