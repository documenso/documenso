import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { UNSAFE_importAcroFormFieldsFromEnvelope } from '@documenso/lib/server-only/envelope-item/import-acroform-fields';
import { UNSAFE_replaceEnvelopeItemPdf } from '@documenso/lib/server-only/envelope-item/replace-envelope-item-pdf';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import { PDF, PdfString } from '@libpdf/core';
import { type APIRequestContext, expect, type Page, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

const ACROFORM_FIXTURE = fs.readFileSync(path.join(__dirname, '../../../../assets/acroform-import-test.pdf'));

const ACROFORM_DOCUMENT_PAYLOAD: TCreateEnvelopePayload = {
  type: EnvelopeType.DOCUMENT,
  title: 'AcroForm document',
  recipients: [
    {
      email: 'signer@example.com',
      name: 'Signer',
      role: RecipientRole.SIGNER,
    },
  ],
};

const API_REQUEST_METADATA: ApiRequestMetadata = {
  requestMetadata: {},
  source: 'apiV1',
  auth: 'api',
};

type TestUser = Awaited<ReturnType<typeof seedUser>>['user'];
type TestTeam = Awaited<ReturnType<typeof seedUser>>['team'];

const seedUserWithApiToken = async (): Promise<{ token: string; user: TestUser; team: TestTeam }> => {
  const { user, team } = await seedUser();
  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test',
    expiresIn: null,
  });

  return { token, user, team };
};

const pdfHasFormFields = async (pdf: Uint8Array): Promise<boolean> => {
  const pdfDoc = await PDF.load(new Uint8Array(pdf));
  const form = pdfDoc.getForm();

  return (form?.fieldCount ?? 0) > 0;
};

const createSignedSignatureAcroFormPdf = (): Promise<Uint8Array> => {
  const pdf = PDF.create();
  const page = pdf.addPage({ size: 'letter' });
  const form = pdf.getOrCreateForm();
  const textField = form.createTextField('full_name');
  const signatureField = form.createSignatureField('signed_signature');

  page.drawField(textField, { x: 100, y: 700, width: 200, height: 24 });
  signatureField.getDict().set('V', PdfString.fromString('fake-signature'));

  return pdf.save();
};

const uploadAcroFormEnvelope = async ({
  request,
  token,
  payload = ACROFORM_DOCUMENT_PAYLOAD,
  file = ACROFORM_FIXTURE,
  fileName = 'acroform-import-test.pdf',
}: {
  request: APIRequestContext;
  token: string;
  payload?: TCreateEnvelopePayload;
  file?: Uint8Array;
  fileName?: string;
}): Promise<TCreateEnvelopeResponse> => {
  const formData = new FormData();

  formData.append('payload', JSON.stringify(payload));
  formData.append('files', new File([file], fileName, { type: 'application/pdf' }));

  const res = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });

  expect(res.ok()).toBeTruthy();

  return (await res.json()) as TCreateEnvelopeResponse;
};

const importAcroFormFieldsWithSession = ({
  page,
  teamId,
  envelopeId,
}: {
  page: Page;
  teamId: number;
  envelopeId: string;
}) =>
  page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.field.importFromPdf`, {
    headers: {
      'content-type': 'application/json',
      'x-team-id': String(teamId),
    },
    data: JSON.stringify({ json: { envelopeId } }),
  });

const loadEnvelopeForImport = async (envelopeId: string) =>
  prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: {
      envelopeItems: { include: { documentData: true } },
      recipients: true,
    },
  });

test.describe.configure({
  mode: 'parallel',
});

test.describe('AcroForm Import', () => {
  test('upload does not create fields and preserves widgets in the stored PDF', async ({ request }) => {
    const { token } = await seedUserWithApiToken();

    const response = await uploadAcroFormEnvelope({ request, token });

    const envelope = await prisma.envelope.findUniqueOrThrow({
      where: { id: response.id },
      include: {
        envelopeItems: { include: { documentData: true } },
        fields: true,
      },
    });

    expect(envelope.fields).toHaveLength(0);

    const pdfBuffer = await getFileServerSide(envelope.envelopeItems[0].documentData);

    expect(await pdfHasFormFields(pdfBuffer)).toBe(true);
  });

  test('replacement preserves widgets in the stored PDF for later import', async ({ request }) => {
    const { token, user } = await seedUserWithApiToken();

    const response = await uploadAcroFormEnvelope({ request, token });

    const envelope = await loadEnvelopeForImport(response.id);
    const oldDocumentDataId = envelope.envelopeItems[0].documentDataId;

    await UNSAFE_replaceEnvelopeItemPdf({
      envelope,
      recipients: envelope.recipients,
      envelopeItemId: envelope.envelopeItems[0].id,
      oldDocumentDataId,
      data: {
        title: 'Replacement AcroForm document',
        file: new File([ACROFORM_FIXTURE], 'replacement-acroform.pdf', { type: 'application/pdf' }),
      },
      user,
      apiRequestMetadata: API_REQUEST_METADATA,
    });

    const after = await prisma.envelope.findUniqueOrThrow({
      where: { id: response.id },
      include: {
        envelopeItems: { include: { documentData: true } },
        fields: true,
      },
    });

    expect(after.fields).toHaveLength(0);
    expect(after.envelopeItems[0].documentDataId).not.toBe(oldDocumentDataId);

    const pdfBuffer = await getFileServerSide(after.envelopeItems[0].documentData);

    expect(await pdfHasFormFields(pdfBuffer)).toBe(true);
  });

  test('import creates fields assigned to the signer, flattens the PDF, and emits audit logs', async ({ request }) => {
    const { token } = await seedUserWithApiToken();

    const response = await uploadAcroFormEnvelope({ request, token });

    const envelope = await loadEnvelopeForImport(response.id);
    const oldDocumentDataId = envelope.envelopeItems[0].documentDataId;

    const result = await UNSAFE_importAcroFormFieldsFromEnvelope({
      envelope,
      apiRequestMetadata: API_REQUEST_METADATA,
    });

    expect(result.fieldsCreated).toBeGreaterThan(0);
    expect(result.itemsProcessed).toBe(1);

    const after = await prisma.envelope.findUniqueOrThrow({
      where: { id: response.id },
      include: {
        envelopeItems: { include: { documentData: true } },
        recipients: true,
        fields: true,
      },
    });

    expect(after.fields.length).toBeGreaterThanOrEqual(8);
    expect(after.fields.every((f) => f.recipientId === after.recipients[0].id)).toBe(true);

    for (const field of after.fields) {
      const meta = field.fieldMeta as { source?: string } | null;
      expect(meta?.source).toBe('acroform');
    }

    const auditEntries = await prisma.documentAuditLog.findMany({
      where: { envelopeId: after.id, type: 'FIELD_CREATED' },
    });

    expect(auditEntries.length).toBe(after.fields.length);

    expect(after.envelopeItems[0].documentDataId).not.toBe(oldDocumentDataId);

    const flattenedPdf = await getFileServerSide(after.envelopeItems[0].documentData);

    expect(await pdfHasFormFields(flattenedPdf)).toBe(false);

    const oldRecord = await prisma.documentData.findUnique({ where: { id: oldDocumentDataId } });

    expect(oldRecord).toBeNull();
  });

  test('import creates a placeholder Recipient 1 SIGNER when no recipients exist', async ({ request }) => {
    const { token } = await seedUserWithApiToken();

    const response = await uploadAcroFormEnvelope({
      request,
      token,
      payload: {
        type: EnvelopeType.DOCUMENT,
        title: 'AcroForm document without recipients',
      },
    });

    const envelope = await loadEnvelopeForImport(response.id);

    expect(envelope.recipients).toHaveLength(0);

    await UNSAFE_importAcroFormFieldsFromEnvelope({
      envelope,
      apiRequestMetadata: API_REQUEST_METADATA,
    });

    const after = await prisma.envelope.findUniqueOrThrow({
      where: { id: response.id },
      include: { recipients: true, fields: true },
    });

    expect(after.recipients).toHaveLength(1);
    expect(after.recipients[0].email).toBe('recipient.1@documenso.com');
    expect(after.recipients[0].role).toBe(RecipientRole.SIGNER);
    expect(after.fields.length).toBeGreaterThanOrEqual(8);
    expect(after.fields.every((f) => f.recipientId === after.recipients[0].id)).toBe(true);
  });

  test('import endpoint rejects template envelopes without mutating stored widgets', async ({ page, request }) => {
    const { token, user, team } = await seedUserWithApiToken();

    const response = await uploadAcroFormEnvelope({
      request,
      token,
      payload: {
        type: EnvelopeType.TEMPLATE,
        title: 'AcroForm template',
      },
    });

    await apiSignin({ page, email: user.email });

    const res = await importAcroFormFieldsWithSession({
      page,
      teamId: team.id,
      envelopeId: response.id,
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);

    const after = await prisma.envelope.findUniqueOrThrow({
      where: { id: response.id },
      include: {
        envelopeItems: { include: { documentData: true } },
        fields: true,
      },
    });

    expect(after.fields).toHaveLength(0);

    const pdfBuffer = await getFileServerSide(after.envelopeItems[0].documentData);

    expect(await pdfHasFormFields(pdfBuffer)).toBe(true);
  });

  test('import does not duplicate fields when signed signatures prevent flattening', async ({ request }) => {
    const { token } = await seedUserWithApiToken();
    const signedPdf = await createSignedSignatureAcroFormPdf();

    const response = await uploadAcroFormEnvelope({
      request,
      token,
      file: signedPdf,
      fileName: 'signed-acroform.pdf',
    });

    const envelope = await loadEnvelopeForImport(response.id);

    const firstResult = await UNSAFE_importAcroFormFieldsFromEnvelope({
      envelope,
      apiRequestMetadata: API_REQUEST_METADATA,
    });

    expect(firstResult.fieldsCreated).toBeGreaterThan(0);
    expect(firstResult.itemsProcessed).toBe(1);
    expect(firstResult.signedSignatureCount).toBe(1);

    const afterFirst = await prisma.envelope.findUniqueOrThrow({
      where: { id: response.id },
      include: {
        envelopeItems: { include: { documentData: true } },
        fields: true,
      },
    });
    const firstFieldCount = afterFirst.fields.length;

    const preservedPdf = await getFileServerSide(afterFirst.envelopeItems[0].documentData);

    expect(await pdfHasFormFields(preservedPdf)).toBe(true);

    const secondEnvelope = await loadEnvelopeForImport(response.id);

    const secondResult = await UNSAFE_importAcroFormFieldsFromEnvelope({
      envelope: secondEnvelope,
      apiRequestMetadata: API_REQUEST_METADATA,
    });

    expect(secondResult.fieldsCreated).toBe(0);
    expect(secondResult.itemsProcessed).toBe(0);

    const afterSecond = await prisma.envelope.findUniqueOrThrow({
      where: { id: response.id },
      include: { fields: true },
    });

    expect(afterSecond.fields).toHaveLength(firstFieldCount);
  });
});
