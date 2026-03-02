import { PDF, StandardFonts } from '@libpdf/core';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { Team, User } from '@documenso/prisma/client';
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
import type { TCreateEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

const FIXTURES_DIR = path.join(__dirname, '../../../../assets/fixtures/auto-placement');

test.describe.configure({ mode: 'parallel' });

test.describe('Placeholder-based field creation', () => {
  let user: User, team: Team, token: string;

  test.beforeEach(async () => {
    ({ user, team } = await seedUser());
    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    }));
  });

  const createEnvelopeWithPdf = async (
    request: APIRequestContext,
    pdfFilename: string,
  ): Promise<TCreateEnvelopeResponse> => {
    const pdfPath = path.join(FIXTURES_DIR, pdfFilename);
    const pdfData = fs.readFileSync(pdfPath);

    const formData = new FormData();

    formData.append(
      'payload',
      JSON.stringify({
        type: EnvelopeType.DOCUMENT,
        title: 'Placeholder Fields Test',
      } satisfies TCreateEnvelopePayload),
    );

    formData.append('files', new File([pdfData], pdfFilename, { type: 'application/pdf' }));

    const res = await request.post(`${baseUrl}/envelope/create`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });

    expect(res.ok()).toBeTruthy();

    return res.json();
  };

  const createEnvelopeItemsWithPdf = async (
    request: APIRequestContext,
    envelopeId: string,
    pdfFilename: string,
  ) => {
    const pdfPath = path.join(FIXTURES_DIR, pdfFilename);
    const pdfData = fs.readFileSync(pdfPath);

    const formData = new FormData();

    formData.append('payload', JSON.stringify({ envelopeId }));
    formData.append('files', new File([pdfData], pdfFilename, { type: 'application/pdf' }));

    const res = await request.post(`${baseUrl}/envelope/item/create-many`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });

    expect(res.ok()).toBeTruthy();

    return res.json();
  };

  const addRecipient = async (request: APIRequestContext, envelopeId: string) => {
    const payload: TCreateEnvelopeRecipientsRequest = {
      envelopeId,
      data: [
        {
          email: user.email,
          name: user.name || '',
          role: RecipientRole.SIGNER,
          accessAuth: [],
          actionAuth: [],
        },
      ],
    };

    const res = await request.post(`${baseUrl}/envelope/recipient/create-many`, {
      headers: { Authorization: `Bearer ${token}` },
      data: payload,
    });

    expect(res.ok()).toBeTruthy();
  };

  const addRecipients = async (
    request: APIRequestContext,
    envelopeId: string,
    recipients: TCreateEnvelopeRecipientsRequest['data'],
  ) => {
    const payload: TCreateEnvelopeRecipientsRequest = {
      envelopeId,
      data: recipients,
    };

    const res = await request.post(`${baseUrl}/envelope/recipient/create-many`, {
      headers: { Authorization: `Bearer ${token}` },
      data: payload,
    });

    expect(res.ok()).toBeTruthy();
  };

  const getEnvelope = async (
    request: APIRequestContext,
    envelopeId: string,
  ): Promise<TGetEnvelopeResponse> => {
    const res = await request.get(`${baseUrl}/envelope/${envelopeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();

    return res.json();
  };

  /**
   * Create a PDF with the same placeholder appearing multiple times at different locations.
   */
  const createPdfWithDuplicatePlaceholders = async (): Promise<Buffer> => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: 'letter' });

    // Draw the same placeholder text at three different Y positions.
    page.drawText('{{initials}}', { x: 50, y: 700, font: StandardFonts.Helvetica, size: 12 });
    page.drawText('{{initials}}', { x: 50, y: 500, font: StandardFonts.Helvetica, size: 12 });
    page.drawText('{{initials}}', { x: 50, y: 300, font: StandardFonts.Helvetica, size: 12 });

    const bytes = await pdf.save();

    return Buffer.from(bytes);
  };

  const createEnvelopeWithPdfBuffer = async (
    request: APIRequestContext,
    pdfBuffer: Buffer,
    filename: string,
  ): Promise<TCreateEnvelopeResponse> => {
    const formData = new FormData();

    formData.append(
      'payload',
      JSON.stringify({
        type: EnvelopeType.DOCUMENT,
        title: 'Placeholder Fields Test',
      } satisfies TCreateEnvelopePayload),
    );

    formData.append('files', new File([pdfBuffer], filename, { type: 'application/pdf' }));

    const res = await request.post(`${baseUrl}/envelope/create`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });

    expect(res.ok()).toBeTruthy();

    return res.json();
  };

  test('should create a field at a placeholder location', async ({ request }) => {
    const envelope = await createEnvelopeWithPdf(request, 'no-recipient-placeholders.pdf');
    await addRecipient(request, envelope.id);

    const envelopeData = await getEnvelope(request, envelope.id);
    const recipientId = envelopeData.recipients[0].id;

    const createFieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        envelopeId: envelope.id,
        data: [
          {
            recipientId,
            type: FieldType.SIGNATURE,
            placeholder: '{{signature}}',
          },
        ],
      },
    });

    expect(createFieldsRes.ok()).toBeTruthy();

    const fields = await prisma.field.findMany({
      where: { envelopeId: envelope.id },
    });

    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe(FieldType.SIGNATURE);

    // Verify the field has non-zero position/dimensions resolved from the placeholder.
    expect(fields[0].positionX.toNumber()).toBeGreaterThan(0);
    expect(fields[0].positionY.toNumber()).toBeGreaterThan(0);
    expect(fields[0].width.toNumber()).toBeGreaterThan(0);
    expect(fields[0].height.toNumber()).toBeGreaterThan(0);
  });

  test('should override width and height when provided', async ({ request }) => {
    const envelope = await createEnvelopeWithPdf(request, 'no-recipient-placeholders.pdf');
    await addRecipient(request, envelope.id);

    const envelopeData = await getEnvelope(request, envelope.id);
    const recipientId = envelopeData.recipients[0].id;

    const createFieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        envelopeId: envelope.id,
        data: [
          {
            recipientId,
            type: FieldType.NAME,
            placeholder: '{{name}}',
            width: 30,
            height: 5,
          },
        ],
      },
    });

    expect(createFieldsRes.ok()).toBeTruthy();

    const fields = await prisma.field.findMany({
      where: { envelopeId: envelope.id },
    });

    expect(fields).toHaveLength(1);
    expect(fields[0].width.toNumber()).toBeCloseTo(30, 1);
    expect(fields[0].height.toNumber()).toBeCloseTo(5, 1);
  });

  test('should fail when placeholder text is not found in the PDF', async ({ request }) => {
    const envelope = await createEnvelopeWithPdf(request, 'no-recipient-placeholders.pdf');
    await addRecipient(request, envelope.id);

    const envelopeData = await getEnvelope(request, envelope.id);
    const recipientId = envelopeData.recipients[0].id;

    const createFieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        envelopeId: envelope.id,
        data: [
          {
            recipientId,
            type: FieldType.TEXT,
            placeholder: '{{nonexistent}}',
          },
        ],
      },
    });

    expect(createFieldsRes.ok()).toBeFalsy();
  });

  test('should create fields using a mix of coordinate and placeholder positioning', async ({
    request,
  }) => {
    const envelope = await createEnvelopeWithPdf(request, 'no-recipient-placeholders.pdf');
    await addRecipient(request, envelope.id);

    const envelopeData = await getEnvelope(request, envelope.id);
    const recipientId = envelopeData.recipients[0].id;

    const createFieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        envelopeId: envelope.id,
        data: [
          {
            recipientId,
            type: FieldType.SIGNATURE,
            placeholder: '{{signature}}',
          },
          {
            recipientId,
            type: FieldType.DATE,
            page: 1,
            positionX: 10,
            positionY: 20,
            width: 15,
            height: 3,
          },
        ],
      },
    });

    expect(createFieldsRes.ok()).toBeTruthy();

    const fields = await prisma.field.findMany({
      where: { envelopeId: envelope.id },
      orderBy: { type: 'asc' },
    });

    expect(fields).toHaveLength(2);

    const dateField = fields.find((f) => f.type === FieldType.DATE);
    const signatureField = fields.find((f) => f.type === FieldType.SIGNATURE);

    expect(dateField).toBeDefined();
    expect(dateField!.positionX.toNumber()).toBeCloseTo(10, 1);
    expect(dateField!.positionY.toNumber()).toBeCloseTo(20, 1);

    expect(signatureField).toBeDefined();
    expect(signatureField!.positionX.toNumber()).toBeGreaterThan(0);
  });

  test('should create a field only at first occurrence by default', async ({ request }) => {
    const pdfBuffer = await createPdfWithDuplicatePlaceholders();
    const envelope = await createEnvelopeWithPdfBuffer(request, pdfBuffer, 'duplicates.pdf');
    await addRecipient(request, envelope.id);

    const envelopeData = await getEnvelope(request, envelope.id);
    const recipientId = envelopeData.recipients[0].id;

    const createFieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        envelopeId: envelope.id,
        data: [
          {
            recipientId,
            type: FieldType.INITIALS,
            placeholder: '{{initials}}',
          },
        ],
      },
    });

    expect(createFieldsRes.ok()).toBeTruthy();

    const fields = await prisma.field.findMany({
      where: { envelopeId: envelope.id },
    });

    // Should only create one field (first occurrence).
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe(FieldType.INITIALS);
  });

  test('should create fields at all occurrences when matchAll is true', async ({ request }) => {
    const pdfBuffer = await createPdfWithDuplicatePlaceholders();
    const envelope = await createEnvelopeWithPdfBuffer(request, pdfBuffer, 'duplicates.pdf');
    await addRecipient(request, envelope.id);

    const envelopeData = await getEnvelope(request, envelope.id);
    const recipientId = envelopeData.recipients[0].id;

    const createFieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        envelopeId: envelope.id,
        data: [
          {
            recipientId,
            type: FieldType.INITIALS,
            placeholder: '{{initials}}',
            matchAll: true,
          },
        ],
      },
    });

    expect(createFieldsRes.ok()).toBeTruthy();

    const fields = await prisma.field.findMany({
      where: { envelopeId: envelope.id },
      orderBy: { positionY: 'asc' },
    });

    // Should create three fields (one for each occurrence).
    expect(fields).toHaveLength(3);

    // All should be INITIALS type.
    expect(fields.every((f) => f.type === FieldType.INITIALS)).toBe(true);

    // Verify they're at different Y positions.
    const yPositions = fields.map((f) => f.positionY.toNumber());
    const uniqueYPositions = new Set(yPositions);

    expect(uniqueYPositions.size).toBe(3);
  });

  test('should map placeholder recipients by signing order when adding items', async ({
    request,
  }) => {
    const envelope = await createEnvelopeWithPdf(request, 'no-recipient-placeholders.pdf');

    await addRecipients(request, envelope.id, [
      {
        email: 'second.recipient@documenso.com',
        name: 'Second Recipient',
        role: RecipientRole.SIGNER,
        signingOrder: 2,
        accessAuth: [],
        actionAuth: [],
      },
      {
        email: 'first.recipient@documenso.com',
        name: 'First Recipient',
        role: RecipientRole.SIGNER,
        signingOrder: 1,
        accessAuth: [],
        actionAuth: [],
      },
    ]);

    await createEnvelopeItemsWithPdf(request, envelope.id, 'project-proposal-single-recipient.pdf');

    const recipients = await prisma.recipient.findMany({
      where: { envelopeId: envelope.id },
    });

    const firstRecipient = recipients.find((recipient) => recipient.signingOrder === 1);

    expect(firstRecipient).toBeDefined();

    const fields = await prisma.field.findMany({
      where: { envelopeId: envelope.id },
    });

    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((field) => field.recipientId === firstRecipient!.id)).toBe(true);
  });
});
