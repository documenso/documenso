import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { setFieldsForTemplate } from '@documenso/lib/server-only/field/set-fields-for-template';
import { updateEnvelopeFields as updateEnvelopeFieldsServerSide } from '@documenso/lib/server-only/field/update-envelope-fields';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { FIELD_RADIO_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, FieldType, RecipientRole } from '@documenso/prisma/client';
import { seedDraftDocument } from '@documenso/prisma/seed/documents';
import { seedTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type {
  TCreateEnvelopeFieldsRequest,
  TCreateEnvelopeFieldsResponse,
} from '@documenso/trpc/server/envelope-router/envelope-fields/create-envelope-fields.types';
import type { TUpdateEnvelopeFieldsRequest } from '@documenso/trpc/server/envelope-router/envelope-fields/update-envelope-fields.types';
import type { TCreateEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import { type APIRequestContext, expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

const createEnvelopeWithRecipient = async (request: APIRequestContext, authToken: string) => {
  const payload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: 'Field Meta Validation Test',
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));

  const pdfData = fs.readFileSync(path.join(__dirname, '../../../../../assets/example.pdf'));
  formData.append('files', new File([pdfData], 'test.pdf', { type: 'application/pdf' }));

  const createRes = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${authToken}` },
    multipart: formData,
  });

  expect(createRes.ok()).toBeTruthy();

  const envelope = (await createRes.json()) as TCreateEnvelopeResponse;

  const recipientsRes = await request.post(`${baseUrl}/envelope/recipient/create-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId: envelope.id,
      data: [
        {
          email: `signer-${Date.now()}@test.documenso.com`,
          name: 'Test Signer',
          role: RecipientRole.SIGNER,
        },
      ],
    } satisfies TCreateEnvelopeRecipientsRequest,
  });

  expect(recipientsRes.ok()).toBeTruthy();

  const recipientId: number = (await recipientsRes.json()).data[0].id;

  return { envelopeId: envelope.id, recipientId };
};

const createEnvelopeFields = async (
  request: APIRequestContext,
  authToken: string,
  payload: TCreateEnvelopeFieldsRequest,
) => {
  return await request.post(`${baseUrl}/envelope/field/create-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: payload,
  });
};

const updateEnvelopeFields = async (
  request: APIRequestContext,
  authToken: string,
  payload: TUpdateEnvelopeFieldsRequest,
) => {
  return await request.post(`${baseUrl}/envelope/field/update-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: payload,
  });
};

const FIELD_POSITION = {
  page: 1,
  positionX: 10,
  positionY: 20,
  width: 20,
  height: 5,
} as const;

const TEXT_FIELD_META = {
  type: 'text',
  label: 'Job Title',
  required: true,
} as const;

const REQUIRED_AND_READ_ONLY_TEXT_META = {
  type: 'text',
  // Set so the only violated rule is required + readOnly.
  text: 'Prefilled',
  required: true,
  readOnly: true,
} as const;

const INVALID_FIELD_META_CASES = [
  {
    type: FieldType.TEXT,
    fieldMeta: { type: 'text', readOnly: true },
    error: 'A read-only field must have text',
  },
  {
    type: FieldType.NUMBER,
    fieldMeta: { type: 'number', minValue: 10, maxValue: 5 },
    error: 'Minimum value cannot be greater than maximum value',
  },
  {
    type: FieldType.CHECKBOX,
    fieldMeta: { type: 'checkbox', values: [] },
    error: 'At least one option must be added',
  },
  {
    type: FieldType.RADIO,
    fieldMeta: {
      type: 'radio',
      values: [
        { id: 1, checked: true, value: 'A' },
        { id: 2, checked: true, value: 'B' },
      ],
    },
    error: 'There cannot be more than one checked option',
  },
  {
    type: FieldType.DROPDOWN,
    fieldMeta: { type: 'dropdown', values: [{ value: 'A' }], defaultValue: 'B' },
    error: 'Default value must be one of the available options',
  },
];

test.describe('Field meta configuration validation', () => {
  let user: User;
  let team: Team;
  let token: string;

  test.beforeEach(async () => {
    ({ user, team } = await seedUser());
    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-field-meta-validation',
      expiresIn: null,
    }));
  });

  test('create-many should reject a field that is both required and read-only', async ({ request }) => {
    const { envelopeId, recipientId } = await createEnvelopeWithRecipient(request, token);

    const res = await createEnvelopeFields(request, token, {
      envelopeId,
      data: [
        {
          recipientId,
          type: FieldType.TEXT,
          ...FIELD_POSITION,
          fieldMeta: REQUIRED_AND_READ_ONLY_TEXT_META,
        },
      ],
    });

    expect(res.status()).toBe(400);

    const errorResponse = await res.json();
    expect(errorResponse.message).toContain('A field cannot be both read-only and required');

    const fieldCount = await prisma.field.count({
      where: { envelopeId },
    });

    expect(fieldCount).toBe(0);
  });

  for (const { type, fieldMeta, error } of INVALID_FIELD_META_CASES) {
    test(`create-many should reject invalid ${type} field meta`, async ({ request }) => {
      const { envelopeId, recipientId } = await createEnvelopeWithRecipient(request, token);

      const res = await request.post(`${baseUrl}/envelope/field/create-many`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          envelopeId,
          data: [{ recipientId, type, ...FIELD_POSITION, fieldMeta }],
        },
      });

      expect(res.status()).toBe(400);

      const errorResponse = await res.json();
      expect(errorResponse.message).toContain(error);

      const fieldCount = await prisma.field.count({
        where: { envelopeId },
      });

      expect(fieldCount).toBe(0);
    });
  }

  test('update-many should reject a field that is both required and read-only', async ({ request }) => {
    const { envelopeId, recipientId } = await createEnvelopeWithRecipient(request, token);

    const createRes = await createEnvelopeFields(request, token, {
      envelopeId,
      data: [
        {
          recipientId,
          type: FieldType.TEXT,
          ...FIELD_POSITION,
          fieldMeta: TEXT_FIELD_META,
        },
      ],
    });

    expect(createRes.ok()).toBeTruthy();

    const { data: createdFields } = (await createRes.json()) as TCreateEnvelopeFieldsResponse;
    const fieldId = createdFields[0].id;

    const res = await updateEnvelopeFields(request, token, {
      envelopeId,
      data: [{ id: fieldId, type: FieldType.TEXT, fieldMeta: REQUIRED_AND_READ_ONLY_TEXT_META }],
    });

    expect(res.status()).toBe(400);

    const errorResponse = await res.json();
    expect(errorResponse.message).toContain('A field cannot be both read-only and required');
    expect(errorResponse.message).toContain(`TEXT field ${fieldId}`);

    const dbField = await prisma.field.findUniqueOrThrow({
      where: { id: fieldId },
    });

    expect(dbField.fieldMeta).toMatchObject(TEXT_FIELD_META);
    expect(dbField.fieldMeta).not.toHaveProperty('readOnly', true);
  });

  test('update-many should accept a valid read-only field', async ({ request }) => {
    const { envelopeId, recipientId } = await createEnvelopeWithRecipient(request, token);

    const createRes = await createEnvelopeFields(request, token, {
      envelopeId,
      data: [
        {
          recipientId,
          type: FieldType.TEXT,
          ...FIELD_POSITION,
          fieldMeta: TEXT_FIELD_META,
        },
      ],
    });

    expect(createRes.ok()).toBeTruthy();

    const { data: createdFields } = (await createRes.json()) as TCreateEnvelopeFieldsResponse;
    const fieldId = createdFields[0].id;

    const readOnlyMeta = {
      type: 'text',
      text: 'Prefilled',
      required: false,
      readOnly: true,
    } as const;

    const res = await updateEnvelopeFields(request, token, {
      envelopeId,
      data: [{ id: fieldId, type: FieldType.TEXT, fieldMeta: readOnlyMeta }],
    });

    expect(res.ok()).toBeTruthy();

    const dbField = await prisma.field.findUniqueOrThrow({
      where: { id: fieldId },
    });

    expect(dbField.fieldMeta).toMatchObject(readOnlyMeta);
  });

  test('V1 envelopes reject a checkbox, radio or dropdown field without field meta, V2 envelopes use the default', async () => {
    const fieldPosition = { pageNumber: 1, pageX: 5, pageY: 10, pageWidth: 20, pageHeight: 5 };

    const saveRadioWithoutMeta = async (internalVersion: number) => {
      const document = await seedDraftDocument(user, team.id, ['no-meta@test.documenso.com'], { internalVersion });

      const recipient = await prisma.recipient.findFirstOrThrow({ where: { envelopeId: document.id } });

      await setFieldsForDocument({
        userId: user.id,
        teamId: team.id,
        id: { type: 'envelopeId', id: document.id },
        fields: [
          {
            type: FieldType.RADIO,
            envelopeItemId: document.envelopeItems[0].id,
            recipientId: recipient.id,
            ...fieldPosition,
          },
        ],
        requestMetadata: { requestMetadata: {}, source: 'app', auth: 'session' },
      });

      return document;
    };

    await expect(saveRadioWithoutMeta(1)).rejects.toThrow(/set at least one value for the Radio field/);

    const legacyTemplate = await seedTemplate({ userId: user.id, teamId: team.id, internalVersion: 1 });

    await expect(
      setFieldsForTemplate({
        userId: user.id,
        teamId: team.id,
        id: { type: 'envelopeId', id: legacyTemplate.id },
        fields: [
          {
            type: FieldType.CHECKBOX,
            envelopeItemId: legacyTemplate.envelopeItems[0].id,
            recipientId: legacyTemplate.recipients[0].id,
            ...fieldPosition,
          },
        ],
      }),
    ).rejects.toThrow(/set at least one value for the Checkbox field/);

    const document = await saveRadioWithoutMeta(2);

    const radioField = await prisma.field.findFirstOrThrow({
      where: { envelopeId: document.id, type: FieldType.RADIO },
    });

    expect(radioField.fieldMeta).toMatchObject(FIELD_RADIO_META_DEFAULT_VALUES);
  });

  test('V1 envelopes accept field meta for another field type, V2 envelopes reject it', async () => {
    // Both metas break the rules of their own type (read-only without a value), so a save only
    // succeeds when meta for another field type is left unvalidated.
    const legacyTextMeta = { type: 'text', readOnly: true } as const;
    const legacyNumberMeta = { type: 'number', readOnly: true } as const;

    const saveSignatureField = async (internalVersion: number) => {
      const document = await seedDraftDocument(user, team.id, ['v1-compat@test.documenso.com'], { internalVersion });

      const recipient = await prisma.recipient.findFirstOrThrow({
        where: { envelopeId: document.id },
      });

      await setFieldsForDocument({
        userId: user.id,
        teamId: team.id,
        id: { type: 'envelopeId', id: document.id },
        fields: [
          {
            type: FieldType.SIGNATURE,
            fieldMeta: legacyTextMeta,
            envelopeItemId: document.envelopeItems[0].id,
            recipientId: recipient.id,
            pageNumber: 1,
            pageX: 5,
            pageY: 10,
            pageWidth: 20,
            pageHeight: 5,
          },
        ],
        requestMetadata: { requestMetadata: {}, source: 'app', auth: 'session' },
      });

      return document;
    };

    await expect(saveSignatureField(2)).rejects.toThrow(/does not match the field type/);

    const legacyDocument = await saveSignatureField(1);

    const legacyField = await prisma.field.findFirstOrThrow({
      where: { envelopeId: legacyDocument.id },
    });

    expect(legacyField).toMatchObject({ type: FieldType.SIGNATURE, fieldMeta: legacyTextMeta });

    await updateEnvelopeFieldsServerSide({
      userId: user.id,
      teamId: team.id,
      id: { type: 'envelopeId', id: legacyDocument.id },
      fields: [{ id: legacyField.id, fieldMeta: legacyNumberMeta }],
      requestMetadata: { requestMetadata: {}, source: 'app', auth: 'session' },
    });

    const updatedField = await prisma.field.findUniqueOrThrow({
      where: { id: legacyField.id },
    });

    expect(updatedField.fieldMeta).toMatchObject(legacyNumberMeta);
  });
});
