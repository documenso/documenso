import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, FieldType, RecipientRole } from '@documenso/prisma/client';
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
});
