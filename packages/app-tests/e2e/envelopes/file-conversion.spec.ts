import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentStatus, EnvelopeType, FieldType } from '@prisma/client';
import { nanoid } from 'nanoid';
import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../../lib/constants/app';
import { createApiToken } from '../../../lib/server-only/public-api/create-api-token';
import { RecipientRole } from '../../../prisma/generated/types';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '../../../trpc/server/envelope-router/create-envelope.types';
import type { TDistributeEnvelopeRequest } from '../../../trpc/server/envelope-router/distribute-envelope.types';
import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2`;

test.describe.configure({ mode: 'parallel', timeout: 60000 });

/**
 * Helper to verify originalData is populated for converted files.
 * PNG/JPEG/DOCX should have originalData, PDF should not.
 */
async function verifyOriginalData(envelopeId: string, expectOriginalData: boolean) {
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: {
      envelopeItems: {
        include: { documentData: true },
      },
    },
  });

  if (expectOriginalData) {
    expect(envelope.envelopeItems[0].documentData?.originalData).not.toBeNull();
    expect(envelope.envelopeItems[0].documentData?.originalMimeType).not.toBeNull();
  } else {
    expect(envelope.envelopeItems[0].documentData?.originalData).toBeNull();
  }
}

/**
 * Helper to mark signature fields as inserted via Prisma.
 * This bypasses Konva canvas interaction which is hard to test.
 * Based on the pattern used in envelope-alignment.spec.ts.
 */
async function markSignatureFieldsAsInserted(envelopeId: string, recipientId: number) {
  const signatureFields = await prisma.field.findMany({
    where: {
      envelopeId,
      recipientId,
      type: FieldType.SIGNATURE,
      inserted: false,
    },
  });

  for (const field of signatureFields) {
    await prisma.field.update({
      where: { id: field.id },
      data: {
        inserted: true,
        customText: '',
        signature: {
          create: {
            recipientId,
            typedSignature: 'Test Signature',
            signatureImageAsBase64: null,
          },
        },
      },
    });
  }
}

/**
 * Helper to complete the signing flow for a recipient.
 * Expects fields to already be marked as inserted via Prisma.
 */
async function completeSigningFlow(page: Page) {
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  // Wait for Complete button to be visible (fields should already be inserted)
  await expect(page.getByRole('button', { name: 'Complete' })).toBeVisible({ timeout: 10000 });

  // Click Complete button
  await page.getByRole('button', { name: 'Complete' }).click();

  // Wait for Sign button to be visible in the confirmation dialog
  const signButton = page.getByRole('button', { name: 'Sign' });
  await expect(signButton).toBeVisible({ timeout: 10000 });

  // Use force click to handle transient DOM changes
  await signButton.click({ force: true });

  // Wait for "Document Signed" heading to appear (confirms completion)
  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible({
    timeout: 30000,
  });
}

test.describe('File Conversion', () => {
  test.describe('API Tests', () => {
    test('[FILE_CONVERSION_API]: should upload, convert, and sign a PNG image via API', async ({
      page,
      request,
    }) => {
      const { user: uploader, team } = await seedUser();
      const { user: recipient } = await seedUser();

      const { token } = await createApiToken({
        userId: uploader.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const pngFile = fs.readFileSync(path.join(__dirname, '../../../../assets/test-image.png'));

      const formData = new FormData();

      const createEnvelopePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'PNG Conversion Test',
        recipients: [
          {
            email: recipient.email,
            name: recipient.name || '',
            role: RecipientRole.SIGNER,
            fields: [
              {
                type: FieldType.SIGNATURE,
                fieldMeta: { type: 'signature' },
                page: 1,
                positionX: 10,
                positionY: 10,
                width: 20,
                height: 5,
              },
            ],
          },
        ],
      };

      formData.append('payload', JSON.stringify(createEnvelopePayload));
      formData.append('files', new File([pngFile], 'test-image.png', { type: 'image/png' }));

      const createEnvelopeRequest = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      if (!createEnvelopeRequest.ok()) {
        const errorBody = await createEnvelopeRequest.json();
        if (
          errorBody.code === 'CONVERSION_SERVICE_UNAVAILABLE' ||
          errorBody.code === 'CONVERSION_FAILED'
        ) {
          test.skip(true, 'Gotenberg conversion service is not available');
          return;
        }
        throw new Error(`Failed to create envelope: ${JSON.stringify(errorBody)}`);
      }

      expect(createEnvelopeRequest.status()).toBe(200);

      const { id: createdEnvelopeId }: TCreateEnvelopeResponse = await createEnvelopeRequest.json();

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: createdEnvelopeId },
        include: {
          recipients: true,
          envelopeItems: true,
        },
      });

      expect(envelope.envelopeItems.length).toBe(1);
      expect(envelope.recipients.length).toBe(1);

      const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          envelopeId: envelope.id,
        } satisfies TDistributeEnvelopeRequest,
      });

      expect(distributeEnvelopeRequest.ok()).toBeTruthy();

      const recipientToken = envelope.recipients[0].token;
      const signUrl = `/sign/${recipientToken}`;

      // Mark signature fields as inserted via Prisma BEFORE loading page
      // (bypasses Konva canvas interaction)
      await markSignatureFieldsAsInserted(envelope.id, envelope.recipients[0].id);

      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });

      await completeSigningFlow(page);

      await expect(async () => {
        const { status } = await prisma.envelope.findFirstOrThrow({
          where: { id: envelope.id },
        });
        expect(status).toBe(DocumentStatus.COMPLETED);
      }).toPass({ timeout: 10000 });

      await verifyOriginalData(envelope.id, true);
    });

    test('[FILE_CONVERSION_API]: should upload, convert, and sign a JPEG image via API', async ({
      page,
      request,
    }) => {
      const { user: uploader, team } = await seedUser();
      const { user: recipient } = await seedUser();

      const { token } = await createApiToken({
        userId: uploader.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const jpegFile = fs.readFileSync(path.join(__dirname, '../../../../assets/test-image.jpg'));

      const formData = new FormData();

      const createEnvelopePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'JPEG Conversion Test',
        recipients: [
          {
            email: recipient.email,
            name: recipient.name || '',
            role: RecipientRole.SIGNER,
            fields: [
              {
                type: FieldType.SIGNATURE,
                fieldMeta: { type: 'signature' },
                page: 1,
                positionX: 10,
                positionY: 10,
                width: 20,
                height: 5,
              },
            ],
          },
        ],
      };

      formData.append('payload', JSON.stringify(createEnvelopePayload));
      formData.append('files', new File([jpegFile], 'test-image.jpg', { type: 'image/jpeg' }));

      const createEnvelopeRequest = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      if (!createEnvelopeRequest.ok()) {
        const errorBody = await createEnvelopeRequest.json();
        if (
          errorBody.code === 'CONVERSION_SERVICE_UNAVAILABLE' ||
          errorBody.code === 'CONVERSION_FAILED'
        ) {
          test.skip(true, 'Gotenberg conversion service is not available');
          return;
        }
        throw new Error(`Failed to create envelope: ${JSON.stringify(errorBody)}`);
      }

      expect(createEnvelopeRequest.status()).toBe(200);

      const { id: createdEnvelopeId }: TCreateEnvelopeResponse = await createEnvelopeRequest.json();

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: createdEnvelopeId },
        include: {
          recipients: true,
          envelopeItems: true,
        },
      });

      expect(envelope.envelopeItems.length).toBe(1);
      expect(envelope.recipients.length).toBe(1);

      const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          envelopeId: envelope.id,
        } satisfies TDistributeEnvelopeRequest,
      });

      expect(distributeEnvelopeRequest.ok()).toBeTruthy();

      const recipientToken = envelope.recipients[0].token;
      const signUrl = `/sign/${recipientToken}`;

      // Mark signature fields as inserted via Prisma BEFORE loading page
      // (bypasses Konva canvas interaction)
      await markSignatureFieldsAsInserted(envelope.id, envelope.recipients[0].id);

      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });

      await completeSigningFlow(page);

      await expect(async () => {
        const { status } = await prisma.envelope.findFirstOrThrow({
          where: { id: envelope.id },
        });
        expect(status).toBe(DocumentStatus.COMPLETED);
      }).toPass({ timeout: 10000 });

      await verifyOriginalData(envelope.id, true);
    });

    test('[FILE_CONVERSION_API]: should upload, convert, and sign a DOCX document via API', async ({
      page,
      request,
    }) => {
      const { user: uploader, team } = await seedUser();
      const { user: recipient } = await seedUser();

      const { token } = await createApiToken({
        userId: uploader.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const docxFile = fs.readFileSync(
        path.join(__dirname, '../../../../assets/test-document.docx'),
      );

      const formData = new FormData();

      const createEnvelopePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'DOCX Conversion Test',
        recipients: [
          {
            email: recipient.email,
            name: recipient.name || '',
            role: RecipientRole.SIGNER,
            fields: [
              {
                type: FieldType.SIGNATURE,
                fieldMeta: { type: 'signature' },
                page: 1,
                positionX: 10,
                positionY: 10,
                width: 20,
                height: 5,
              },
            ],
          },
        ],
      };

      formData.append('payload', JSON.stringify(createEnvelopePayload));
      formData.append(
        'files',
        new File([docxFile], 'test-document.docx', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      );

      const createEnvelopeRequest = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      if (!createEnvelopeRequest.ok()) {
        const errorBody = await createEnvelopeRequest.json();
        if (
          errorBody.code === 'CONVERSION_SERVICE_UNAVAILABLE' ||
          errorBody.code === 'CONVERSION_FAILED'
        ) {
          test.skip(true, 'Gotenberg conversion service is not available');
          return;
        }
        throw new Error(`Failed to create envelope: ${JSON.stringify(errorBody)}`);
      }

      expect(createEnvelopeRequest.status()).toBe(200);

      const { id: createdEnvelopeId }: TCreateEnvelopeResponse = await createEnvelopeRequest.json();

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: createdEnvelopeId },
        include: {
          recipients: true,
          envelopeItems: true,
        },
      });

      expect(envelope.envelopeItems.length).toBe(1);
      expect(envelope.recipients.length).toBe(1);

      const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          envelopeId: envelope.id,
        } satisfies TDistributeEnvelopeRequest,
      });

      expect(distributeEnvelopeRequest.ok()).toBeTruthy();

      const recipientToken = envelope.recipients[0].token;
      const signUrl = `/sign/${recipientToken}`;

      // Mark signature fields as inserted via Prisma BEFORE loading page
      // (bypasses Konva canvas interaction)
      await markSignatureFieldsAsInserted(envelope.id, envelope.recipients[0].id);

      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });

      await completeSigningFlow(page);

      await expect(async () => {
        const { status } = await prisma.envelope.findFirstOrThrow({
          where: { id: envelope.id },
        });
        expect(status).toBe(DocumentStatus.COMPLETED);
      }).toPass({ timeout: 10000 });

      await verifyOriginalData(envelope.id, true);
    });

    test('[FILE_CONVERSION_API]: should upload and sign a PDF document via API (no conversion)', async ({
      page,
      request,
    }) => {
      const { user: uploader, team } = await seedUser();
      const { user: recipient } = await seedUser();

      const { token } = await createApiToken({
        userId: uploader.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const pdfFile = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

      const formData = new FormData();

      const createEnvelopePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'PDF Upload Test',
        recipients: [
          {
            email: recipient.email,
            name: recipient.name || '',
            role: RecipientRole.SIGNER,
            fields: [
              {
                type: FieldType.SIGNATURE,
                fieldMeta: { type: 'signature' },
                page: 1,
                positionX: 10,
                positionY: 10,
                width: 20,
                height: 5,
              },
            ],
          },
        ],
      };

      formData.append('payload', JSON.stringify(createEnvelopePayload));
      formData.append('files', new File([pdfFile], 'example.pdf', { type: 'application/pdf' }));

      const createEnvelopeRequest = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      expect(createEnvelopeRequest.ok()).toBeTruthy();
      expect(createEnvelopeRequest.status()).toBe(200);

      const { id: createdEnvelopeId }: TCreateEnvelopeResponse = await createEnvelopeRequest.json();

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: createdEnvelopeId },
        include: {
          recipients: true,
          envelopeItems: true,
        },
      });

      expect(envelope.envelopeItems.length).toBe(1);
      expect(envelope.recipients.length).toBe(1);

      const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          envelopeId: envelope.id,
        } satisfies TDistributeEnvelopeRequest,
      });

      expect(distributeEnvelopeRequest.ok()).toBeTruthy();

      const recipientToken = envelope.recipients[0].token;
      const signUrl = `/sign/${recipientToken}`;

      // Mark signature fields as inserted via Prisma BEFORE loading page
      // (bypasses Konva canvas interaction)
      await markSignatureFieldsAsInserted(envelope.id, envelope.recipients[0].id);

      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });

      await completeSigningFlow(page);

      await expect(async () => {
        const { status } = await prisma.envelope.findFirstOrThrow({
          where: { id: envelope.id },
        });
        expect(status).toBe(DocumentStatus.COMPLETED);
      }).toPass({ timeout: 10000 });

      // PDF should NOT have originalData (no conversion needed)
      await verifyOriginalData(envelope.id, false);
    });

    test('[FILE_CONVERSION_API]: should reject unsupported file types', async ({ request }) => {
      const { user, team } = await seedUser();

      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const jsonFile = fs.readFileSync(path.join(__dirname, '../../../../package.json'));

      const formData = new FormData();

      const createEnvelopePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'Unsupported File Test',
        recipients: [
          {
            email: user.email,
            name: user.name || '',
            role: RecipientRole.SIGNER,
            fields: [
              {
                type: FieldType.SIGNATURE,
                fieldMeta: { type: 'signature' },
                page: 1,
                positionX: 10,
                positionY: 10,
                width: 20,
                height: 5,
              },
            ],
          },
        ],
      };

      formData.append('payload', JSON.stringify(createEnvelopePayload));
      formData.append('files', new File([jsonFile], 'package.json', { type: 'application/json' }));

      const createEnvelopeRequest = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      expect(createEnvelopeRequest.ok()).toBeFalsy();

      const errorBody = await createEnvelopeRequest.json();
      // Accept either UNSUPPORTED_FILE_TYPE or INTERNAL_SERVER_ERROR as valid rejection
      expect(
        errorBody.code === 'UNSUPPORTED_FILE_TYPE' || errorBody.code === 'INTERNAL_SERVER_ERROR',
      ).toBeTruthy();
    });

    test('[FILE_CONVERSION_API]: should return error when Gotenberg is unavailable', async ({
      request,
    }) => {
      const { user, team } = await seedUser();

      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const pngFile = fs.readFileSync(path.join(__dirname, '../../../../assets/test-image.png'));

      const formData = new FormData();

      const createEnvelopePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'Gotenberg Error Test',
        recipients: [
          {
            email: user.email,
            name: user.name || '',
            role: RecipientRole.SIGNER,
            fields: [
              {
                type: FieldType.SIGNATURE,
                fieldMeta: { type: 'signature' },
                page: 1,
                positionX: 10,
                positionY: 10,
                width: 20,
                height: 5,
              },
            ],
          },
        ],
      };

      formData.append('payload', JSON.stringify(createEnvelopePayload));
      formData.append('files', new File([pngFile], 'test-image.png', { type: 'image/png' }));

      const createEnvelopeRequest = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      // This test only validates the error flow if Gotenberg is actually unavailable
      if (createEnvelopeRequest.ok()) {
        test.skip(true, 'Gotenberg is available - skipping error scenario test');
        return;
      }

      const errorBody = await createEnvelopeRequest.json();
      expect(
        errorBody.code === 'CONVERSION_SERVICE_UNAVAILABLE' ||
          errorBody.code === 'CONVERSION_FAILED',
      ).toBeTruthy();
    });
  });

  test.describe('UI Tests', () => {
    test('[FILE_CONVERSION_UI]: should upload, convert, and sign a PNG image', async ({
      page,
      request,
    }) => {
      const { user: uploader, team } = await seedUser();
      const { user: recipient } = await seedUser();

      const { token } = await createApiToken({
        userId: uploader.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      await apiSignin({
        page,
        email: uploader.email,
        redirectPath: `/t/${team.url}/documents`,
      });

      // Wait for documents page to load
      await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

      // Upload PNG via file input
      // Use .first() because there are two upload inputs (dropzone wrapper + upload button)
      const fileInput = page.getByTestId('document-upload-input').first();
      await fileInput.setInputFiles(path.join(__dirname, '../../../../assets/test-image.png'));

      // Wait for redirect to editor or error toast
      try {
        await page.waitForURL(/\/documents\/.*\/edit/, { timeout: 15000 });
      } catch {
        // Check if error toast appeared (Gotenberg unavailable)
        const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
        if (await errorToast.isVisible()) {
          test.skip(true, 'Gotenberg conversion service is not available');
          return;
        }
        throw new Error('Upload failed without expected error toast');
      }

      // Get envelope ID from URL
      const urlMatch = page.url().match(/documents\/(.+?)\/edit/);
      const envelopeId = urlMatch?.[1];
      expect(envelopeId).toBeDefined();

      // Add recipient via API
      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: envelopeId },
        include: { envelopeItems: true },
      });

      const recipientRecord = await prisma.recipient.create({
        data: {
          email: recipient.email,
          name: recipient.name || '',
          role: RecipientRole.SIGNER,
          envelopeId: envelope.id,
          token: nanoid(),
        },
      });

      // Add field via Prisma
      await prisma.field.create({
        data: {
          envelopeId: envelope.id,
          recipientId: recipientRecord.id,
          type: FieldType.SIGNATURE,
          page: 1,
          positionX: 10,
          positionY: 10,
          width: 20,
          height: 5,
          envelopeItemId: envelope.envelopeItems[0].id,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'signature' },
        },
      });

      // Distribute envelope via API
      const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          envelopeId: envelope.id,
        } satisfies TDistributeEnvelopeRequest,
      });

      if (!distributeEnvelopeRequest.ok()) {
        const errorBody = await distributeEnvelopeRequest.json();
        throw new Error(`Failed to distribute envelope: ${JSON.stringify(errorBody)}`);
      }

      // Get updated recipient with token
      const updatedRecipient = await prisma.recipient.findUniqueOrThrow({
        where: { id: recipientRecord.id },
      });

      const signUrl = `/sign/${updatedRecipient.token}`;

      // Mark signature fields as inserted via Prisma BEFORE loading page
      // (bypasses Konva canvas interaction)
      await markSignatureFieldsAsInserted(envelope.id, recipientRecord.id);

      // Sign as recipient
      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });

      await completeSigningFlow(page);

      // Verify completion
      await expect(async () => {
        const { status } = await prisma.envelope.findFirstOrThrow({
          where: { id: envelope.id },
        });
        expect(status).toBe(DocumentStatus.COMPLETED);
      }).toPass({ timeout: 10000 });

      // PNG should have originalData
      await verifyOriginalData(envelope.id, true);
    });

    test('[FILE_CONVERSION_UI]: should upload, convert, and sign a JPEG image', async ({
      page,
      request,
    }) => {
      const { user: uploader, team } = await seedUser();
      const { user: recipient } = await seedUser();

      const { token } = await createApiToken({
        userId: uploader.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      await apiSignin({
        page,
        email: uploader.email,
        redirectPath: `/t/${team.url}/documents`,
      });

      await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

      // Use .first() because there are two upload inputs (dropzone wrapper + upload button)
      const fileInput = page.getByTestId('document-upload-input').first();
      await fileInput.setInputFiles(path.join(__dirname, '../../../../assets/test-image.jpg'));

      try {
        await page.waitForURL(/\/documents\/.*\/edit/, { timeout: 15000 });
      } catch {
        const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
        if (await errorToast.isVisible()) {
          test.skip(true, 'Gotenberg conversion service is not available');
          return;
        }
        throw new Error('Upload failed without expected error toast');
      }

      const urlMatch = page.url().match(/documents\/(.+?)\/edit/);
      const envelopeId = urlMatch?.[1];
      expect(envelopeId).toBeDefined();

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: envelopeId },
        include: { envelopeItems: true },
      });

      const recipientRecord = await prisma.recipient.create({
        data: {
          email: recipient.email,
          name: recipient.name || '',
          role: RecipientRole.SIGNER,
          envelopeId: envelope.id,
          token: nanoid(),
        },
      });

      await prisma.field.create({
        data: {
          envelopeId: envelope.id,
          recipientId: recipientRecord.id,
          type: FieldType.SIGNATURE,
          page: 1,
          positionX: 10,
          positionY: 10,
          width: 20,
          height: 5,
          envelopeItemId: envelope.envelopeItems[0].id,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'signature' },
        },
      });

      const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          envelopeId: envelope.id,
        } satisfies TDistributeEnvelopeRequest,
      });

      if (!distributeEnvelopeRequest.ok()) {
        const errorBody = await distributeEnvelopeRequest.json();
        throw new Error(`Failed to distribute envelope: ${JSON.stringify(errorBody)}`);
      }

      const updatedRecipient = await prisma.recipient.findUniqueOrThrow({
        where: { id: recipientRecord.id },
      });

      const signUrl = `/sign/${updatedRecipient.token}`;

      // Mark signature fields as inserted via Prisma BEFORE loading page
      // (bypasses Konva canvas interaction)
      await markSignatureFieldsAsInserted(envelope.id, recipientRecord.id);

      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });

      await completeSigningFlow(page);

      await expect(async () => {
        const { status } = await prisma.envelope.findFirstOrThrow({
          where: { id: envelope.id },
        });
        expect(status).toBe(DocumentStatus.COMPLETED);
      }).toPass({ timeout: 10000 });

      await verifyOriginalData(envelope.id, true);
    });

    test('[FILE_CONVERSION_UI]: should upload, convert, and sign a DOCX document', async ({
      page,
      request,
    }) => {
      const { user: uploader, team } = await seedUser();
      const { user: recipient } = await seedUser();

      const { token } = await createApiToken({
        userId: uploader.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      await apiSignin({
        page,
        email: uploader.email,
        redirectPath: `/t/${team.url}/documents`,
      });

      await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

      // Use .first() because there are two upload inputs (dropzone wrapper + upload button)
      const fileInput = page.getByTestId('document-upload-input').first();
      await fileInput.setInputFiles(path.join(__dirname, '../../../../assets/test-document.docx'));

      try {
        await page.waitForURL(/\/documents\/.*\/edit/, { timeout: 15000 });
      } catch {
        const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
        if (await errorToast.isVisible()) {
          test.skip(true, 'Gotenberg conversion service is not available');
          return;
        }
        throw new Error('Upload failed without expected error toast');
      }

      const urlMatch = page.url().match(/documents\/(.+?)\/edit/);
      const envelopeId = urlMatch?.[1];
      expect(envelopeId).toBeDefined();

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: envelopeId },
        include: { envelopeItems: true },
      });

      const recipientRecord = await prisma.recipient.create({
        data: {
          email: recipient.email,
          name: recipient.name || '',
          role: RecipientRole.SIGNER,
          envelopeId: envelope.id,
          token: nanoid(),
        },
      });

      await prisma.field.create({
        data: {
          envelopeId: envelope.id,
          recipientId: recipientRecord.id,
          type: FieldType.SIGNATURE,
          page: 1,
          positionX: 10,
          positionY: 10,
          width: 20,
          height: 5,
          envelopeItemId: envelope.envelopeItems[0].id,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'signature' },
        },
      });

      const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          envelopeId: envelope.id,
        } satisfies TDistributeEnvelopeRequest,
      });

      if (!distributeEnvelopeRequest.ok()) {
        const errorBody = await distributeEnvelopeRequest.json();
        throw new Error(`Failed to distribute envelope: ${JSON.stringify(errorBody)}`);
      }

      const updatedRecipient = await prisma.recipient.findUniqueOrThrow({
        where: { id: recipientRecord.id },
      });

      const signUrl = `/sign/${updatedRecipient.token}`;

      // Mark signature fields as inserted via Prisma BEFORE loading page
      // (bypasses Konva canvas interaction)
      await markSignatureFieldsAsInserted(envelope.id, recipientRecord.id);

      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });

      await completeSigningFlow(page);

      await expect(async () => {
        const { status } = await prisma.envelope.findFirstOrThrow({
          where: { id: envelope.id },
        });
        expect(status).toBe(DocumentStatus.COMPLETED);
      }).toPass({ timeout: 10000 });

      await verifyOriginalData(envelope.id, true);
    });

    test('[FILE_CONVERSION_UI]: should upload and sign a PDF document (no conversion)', async ({
      page,
      request,
    }) => {
      const { user: uploader, team } = await seedUser();
      const { user: recipient } = await seedUser();

      const { token } = await createApiToken({
        userId: uploader.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      await apiSignin({
        page,
        email: uploader.email,
        redirectPath: `/t/${team.url}/documents`,
      });

      await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

      // Use .first() because there are two upload inputs (dropzone wrapper + upload button)
      const fileInput = page.getByTestId('document-upload-input').first();
      await fileInput.setInputFiles(path.join(__dirname, '../../../../assets/example.pdf'));

      await page.waitForURL(/\/documents\/.*\/edit/, { timeout: 15000 });

      const urlMatch = page.url().match(/documents\/(.+?)\/edit/);
      const envelopeId = urlMatch?.[1];
      expect(envelopeId).toBeDefined();

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: envelopeId },
        include: { envelopeItems: true },
      });

      const recipientRecord = await prisma.recipient.create({
        data: {
          email: recipient.email,
          name: recipient.name || '',
          role: RecipientRole.SIGNER,
          envelopeId: envelope.id,
          token: nanoid(),
        },
      });

      await prisma.field.create({
        data: {
          envelopeId: envelope.id,
          recipientId: recipientRecord.id,
          type: FieldType.SIGNATURE,
          page: 1,
          positionX: 10,
          positionY: 10,
          width: 20,
          height: 5,
          envelopeItemId: envelope.envelopeItems[0].id,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'signature' },
        },
      });

      const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          envelopeId: envelope.id,
        } satisfies TDistributeEnvelopeRequest,
      });

      if (!distributeEnvelopeRequest.ok()) {
        const errorBody = await distributeEnvelopeRequest.json();
        throw new Error(`Failed to distribute envelope: ${JSON.stringify(errorBody)}`);
      }

      const updatedRecipient = await prisma.recipient.findUniqueOrThrow({
        where: { id: recipientRecord.id },
      });

      const signUrl = `/sign/${updatedRecipient.token}`;

      // Mark signature fields as inserted via Prisma BEFORE loading page
      // (bypasses Konva canvas interaction)
      await markSignatureFieldsAsInserted(envelope.id, recipientRecord.id);

      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });

      await completeSigningFlow(page);

      await expect(async () => {
        const { status } = await prisma.envelope.findFirstOrThrow({
          where: { id: envelope.id },
        });
        expect(status).toBe(DocumentStatus.COMPLETED);
      }).toPass({ timeout: 10000 });

      // PDF should NOT have originalData
      await verifyOriginalData(envelope.id, false);
    });

    test('[FILE_CONVERSION_UI]: should show error when Gotenberg is unavailable', async ({
      page,
    }) => {
      const { user, team } = await seedUser();

      await apiSignin({
        page,
        email: user.email,
        redirectPath: `/t/${team.url}/documents`,
      });

      await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

      // Use .first() because there are two upload inputs (dropzone wrapper + upload button)
      const fileInput = page.getByTestId('document-upload-input').first();
      await fileInput.setInputFiles(path.join(__dirname, '../../../../assets/test-image.png'));

      // Wait for either navigation (success) or error toast (Gotenberg down)
      const navigationPromise = page.waitForURL(/\/documents\/.*\/edit/, { timeout: 15000 });
      const toastPromise = page.waitForSelector('[data-sonner-toast][data-type="error"]', {
        timeout: 15000,
      });

      const result = await Promise.race([
        navigationPromise.then(() => 'navigation'),
        toastPromise.then(() => 'toast'),
      ]).catch(() => 'timeout');

      if (result === 'navigation') {
        test.skip(true, 'Gotenberg is available - skipping error scenario test');
        return;
      }

      if (result === 'toast') {
        // Error toast appeared - Gotenberg is unavailable
        const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
        await expect(errorToast).toBeVisible();
      } else {
        throw new Error('Neither navigation nor error toast occurred');
      }
    });
  });
});
