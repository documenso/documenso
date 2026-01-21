import { PDF } from '@libpdf/core';
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

// Form field names in the test PDF
const FORM_FIELDS = {
  TEXT_FIELD: 'test_text_field',
  COMPANY_NAME: 'company_name',
  CHECKBOX: 'accept_terms',
  DROPDOWN: 'country',
} as const;

// Test values to insert into form fields
const TEST_FORM_VALUES = {
  [FORM_FIELDS.TEXT_FIELD]: 'Hello World',
  [FORM_FIELDS.COMPANY_NAME]: 'Documenso Inc.',
  [FORM_FIELDS.CHECKBOX]: true,
  [FORM_FIELDS.DROPDOWN]: 'Germany',
};

/**
 * Helper to check if a PDF has interactive form fields.
 * Returns true if the PDF has form fields, false if they've been flattened.
 */
async function pdfHasFormFields(pdfBuffer: Uint8Array): Promise<boolean> {
  const pdfDoc = await PDF.load(new Uint8Array(pdfBuffer));

  const form = await pdfDoc.getForm();

  if (!form) {
    return false;
  }

  return form.fieldCount > 0;
}

/**
 * Helper to get form field names from a PDF.
 */
async function getPdfFormFieldNames(pdfBuffer: Uint8Array): Promise<string[]> {
  const pdfDoc = await PDF.load(new Uint8Array(pdfBuffer));

  const form = await pdfDoc.getForm();

  if (!form) {
    return [];
  }

  return form.getFieldNames();
}

/**
 * Helper to get the value of a text field in a PDF.
 */
async function getPdfTextFieldValue(
  pdfBuffer: Uint8Array,
  fieldName: string,
): Promise<string | undefined> {
  const pdfDoc = await PDF.load(new Uint8Array(pdfBuffer));

  const form = await pdfDoc.getForm();

  if (!form) {
    return undefined;
  }

  const textField = form.getTextField(fieldName);

  if (!textField) {
    return undefined;
  }

  return textField.getValue();
}

test.describe.configure({
  mode: 'parallel',
});

test.describe('Form Flattening', () => {
  const formFieldsPdf = fs.readFileSync(
    path.join(__dirname, '../../../../assets/form-fields-test.pdf'),
  );

  test.describe('Envelope Creation (DOCUMENT type)', () => {
    test('should flatten form fields when creating a DOCUMENT envelope with formValues', async ({
      request,
    }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const payload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'Document with Form Values',
        formValues: TEST_FORM_VALUES,
      };

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const response = (await res.json()) as TCreateEnvelopeResponse;

      // Verify the envelope was created with the correct formValues
      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: response.id },
        include: {
          envelopeItems: {
            include: { documentData: true },
          },
        },
      });

      expect(envelope.formValues).toEqual(TEST_FORM_VALUES);
      expect(envelope.type).toBe(EnvelopeType.DOCUMENT);

      // Get the PDF and verify form fields are flattened
      const documentData = envelope.envelopeItems[0].documentData;
      const pdfBuffer = await getFileServerSide(documentData);

      const hasFormFields = await pdfHasFormFields(pdfBuffer);

      expect(hasFormFields).toBe(false);
    });

    test('should flatten form fields when creating a DOCUMENT envelope without formValues', async ({
      request,
    }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const payload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'Document without Form Values',
        // No formValues - but form should still be flattened for DOCUMENT type
      };

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const response = (await res.json()) as TCreateEnvelopeResponse;

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: response.id },
        include: {
          envelopeItems: {
            include: { documentData: true },
          },
        },
      });

      // Get the PDF and verify form fields are flattened
      const documentData = envelope.envelopeItems[0].documentData;
      const pdfBuffer = await getFileServerSide(documentData);

      const hasFormFields = await pdfHasFormFields(pdfBuffer);

      expect(hasFormFields).toBe(false);
    });
  });

  test.describe('Template Creation (TEMPLATE type)', () => {
    test('should NOT flatten form fields when creating a TEMPLATE envelope', async ({
      request,
    }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const payload: TCreateEnvelopePayload = {
        type: EnvelopeType.TEMPLATE,
        title: 'Template with Form Fields',
        // Note: formValues can be set but form should NOT be flattened for templates
      };

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const response = (await res.json()) as TCreateEnvelopeResponse;

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: response.id },
        include: {
          envelopeItems: {
            include: { documentData: true },
          },
        },
      });

      expect(envelope.type).toBe(EnvelopeType.TEMPLATE);

      // Get the PDF and verify form fields are NOT flattened
      const documentData = envelope.envelopeItems[0].documentData;
      const pdfBuffer = await getFileServerSide(documentData);

      const hasFormFields = await pdfHasFormFields(pdfBuffer);

      expect(hasFormFields).toBe(true);

      // Verify the specific form fields still exist
      const fieldNames = await getPdfFormFieldNames(pdfBuffer);

      expect(fieldNames).toContain(FORM_FIELDS.TEXT_FIELD);
      expect(fieldNames).toContain(FORM_FIELDS.COMPANY_NAME);
      expect(fieldNames).toContain(FORM_FIELDS.CHECKBOX);
      expect(fieldNames).toContain(FORM_FIELDS.DROPDOWN);
    });

    test('should preserve form fields in template even when formValues are provided', async ({
      request,
    }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const payload: TCreateEnvelopePayload = {
        type: EnvelopeType.TEMPLATE,
        title: 'Template with Form Values',
        formValues: TEST_FORM_VALUES,
      };

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const response = (await res.json()) as TCreateEnvelopeResponse;

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: response.id },
        include: {
          envelopeItems: {
            include: { documentData: true },
          },
        },
      });

      // formValues should be stored in the database
      expect(envelope.formValues).toEqual(TEST_FORM_VALUES);
      expect(envelope.type).toBe(EnvelopeType.TEMPLATE);

      // But the PDF should still have interactive form fields
      const documentData = envelope.envelopeItems[0].documentData;
      const pdfBuffer = await getFileServerSide(documentData);

      const hasFormFields = await pdfHasFormFields(pdfBuffer);

      expect(hasFormFields).toBe(true);
      expect(await getPdfTextFieldValue(pdfBuffer, FORM_FIELDS.TEXT_FIELD)).toBe(
        TEST_FORM_VALUES[FORM_FIELDS.TEXT_FIELD],
      );
    });
  });

  test.describe('Document from Template', () => {
    test('should flatten form fields when creating document from template with formValues', async ({
      request,
    }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      // First, create a template via API
      const templatePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.TEMPLATE,
        title: 'Template for Document Creation',
        recipients: [
          {
            email: 'recipient@example.com',
            name: 'Test Recipient',
            role: RecipientRole.SIGNER,
          },
        ],
      };

      const templateFormData = new FormData();
      templateFormData.append('payload', JSON.stringify(templatePayload));
      templateFormData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const templateRes = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: templateFormData,
      });

      expect(templateRes.ok()).toBeTruthy();
      const templateResponse = (await templateRes.json()) as TCreateEnvelopeResponse;

      // Verify template has form fields
      const template = await prisma.envelope.findUniqueOrThrow({
        where: { id: templateResponse.id },
        include: {
          envelopeItems: { include: { documentData: true } },
          recipients: true,
        },
      });

      const templatePdfBuffer = await getFileServerSide(template.envelopeItems[0].documentData);

      expect(await pdfHasFormFields(templatePdfBuffer)).toBe(true);

      // Now create a document from the template with formValues
      const useTemplateRes = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipients: [
            {
              id: template.recipients[0].id,
              email: 'recipient@example.com',
              name: 'Test Recipient',
            },
          ],
          formValues: TEST_FORM_VALUES,
        },
      });

      expect(useTemplateRes.ok()).toBeTruthy();
      expect(useTemplateRes.status()).toBe(200);

      const documentResponse = await useTemplateRes.json();

      // Get the created document
      const document = await prisma.envelope.findFirstOrThrow({
        where: {
          id: documentResponse.envelopeId,
        },
        include: {
          envelopeItems: { include: { documentData: true } },
        },
      });

      expect(document.type).toBe(EnvelopeType.DOCUMENT);

      // Verify form fields are flattened in the created document
      const documentPdfBuffer = await getFileServerSide(document.envelopeItems[0].documentData);
      const hasFormFields = await pdfHasFormFields(documentPdfBuffer);

      expect(hasFormFields).toBe(false);
    });

    test('should flatten form fields when creating document from template without formValues', async ({
      request,
    }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      // Create a template
      const templatePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.TEMPLATE,
        title: 'Template without Form Values',
        recipients: [
          {
            email: 'recipient@example.com',
            name: 'Test Recipient',
            role: RecipientRole.SIGNER,
          },
        ],
      };

      const templateFormData = new FormData();
      templateFormData.append('payload', JSON.stringify(templatePayload));
      templateFormData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const templateRes = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: templateFormData,
      });

      expect(templateRes.ok()).toBeTruthy();
      const templateResponse = (await templateRes.json()) as TCreateEnvelopeResponse;

      const template = await prisma.envelope.findUniqueOrThrow({
        where: { id: templateResponse.id },
        include: {
          envelopeItems: { include: { documentData: true } },
          recipients: true,
        },
      });

      // Create document from template WITHOUT formValues
      const useTemplateRes = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipients: [
            {
              id: template.recipients[0].id,
              email: 'recipient@example.com',
              name: 'Test Recipient',
            },
          ],
          // No formValues provided
        },
      });

      expect(useTemplateRes.ok()).toBeTruthy();
      const documentResponse = await useTemplateRes.json();

      const document = await prisma.envelope.findFirstOrThrow({
        where: { id: documentResponse.envelopeId },
        include: {
          envelopeItems: { include: { documentData: true } },
        },
      });

      expect(document.type).toBe(EnvelopeType.DOCUMENT);

      // Form fields should still be flattened even without formValues
      const documentPdfBuffer = await getFileServerSide(document.envelopeItems[0].documentData);
      const hasFormFields = await pdfHasFormFields(documentPdfBuffer);

      expect(hasFormFields).toBe(false);
    });

    test('should use template formValues when creating document without override', async ({
      request,
    }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      // Create a template with formValues
      const templatePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.TEMPLATE,
        title: 'Template with Default Form Values',
        formValues: {
          [FORM_FIELDS.TEXT_FIELD]: 'Default Value',
          [FORM_FIELDS.COMPANY_NAME]: 'Default Company',
        },
        recipients: [
          {
            email: 'recipient@example.com',
            name: 'Test Recipient',
            role: RecipientRole.SIGNER,
          },
        ],
      };

      const templateFormData = new FormData();
      templateFormData.append('payload', JSON.stringify(templatePayload));
      templateFormData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const templateRes = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: templateFormData,
      });

      expect(templateRes.ok()).toBeTruthy();
      const templateResponse = (await templateRes.json()) as TCreateEnvelopeResponse;

      const template = await prisma.envelope.findUniqueOrThrow({
        where: { id: templateResponse.id },
        include: {
          envelopeItems: { include: { documentData: true } },
          recipients: true,
        },
      });

      // Verify template stored the formValues
      expect(template.formValues).toEqual({
        [FORM_FIELDS.TEXT_FIELD]: 'Default Value',
        [FORM_FIELDS.COMPANY_NAME]: 'Default Company',
      });

      // Create document from template without providing new formValues
      // The template's formValues should be used
      const useTemplateRes = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipients: [
            {
              id: template.recipients[0].id,
              email: 'recipient@example.com',
              name: 'Test Recipient',
            },
          ],
          // No formValues - should inherit from template
        },
      });

      expect(useTemplateRes.ok()).toBeTruthy();
      const documentResponse = await useTemplateRes.json();

      const document = await prisma.envelope.findFirstOrThrow({
        where: { id: documentResponse.envelopeId },
        include: {
          envelopeItems: { include: { documentData: true } },
        },
      });

      // Form fields should be flattened
      const documentPdfBuffer = await getFileServerSide(document.envelopeItems[0].documentData);

      expect(await pdfHasFormFields(documentPdfBuffer)).toBe(false);
    });
  });

  test.describe('Form Values Verification', () => {
    test('should correctly insert form values into PDF before flattening', async ({ request }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      // Create a template first (form fields preserved)
      const templatePayload: TCreateEnvelopePayload = {
        type: EnvelopeType.TEMPLATE,
        title: 'Template for Value Verification',
        recipients: [
          {
            email: 'recipient@example.com',
            name: 'Test Recipient',
            role: RecipientRole.SIGNER,
          },
        ],
      };

      const templateFormData = new FormData();

      templateFormData.append('payload', JSON.stringify(templatePayload));
      templateFormData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const templateRes = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: templateFormData,
      });

      const templateResponse = (await templateRes.json()) as TCreateEnvelopeResponse;
      const template = await prisma.envelope.findUniqueOrThrow({
        where: { id: templateResponse.id },
        include: {
          envelopeItems: { include: { documentData: true } },
          recipients: true,
        },
      });

      // Verify template PDF still has form fields
      const templatePdfBuffer = await getFileServerSide(template.envelopeItems[0].documentData);
      expect(await pdfHasFormFields(templatePdfBuffer)).toBe(true);

      // Verify we can read a text field value (should be empty initially)
      const initialValue = await getPdfTextFieldValue(templatePdfBuffer, FORM_FIELDS.TEXT_FIELD);
      expect(initialValue).toBe('');

      // Now create a document with form values
      const testValues = {
        [FORM_FIELDS.TEXT_FIELD]: 'Inserted Text Value',
        [FORM_FIELDS.COMPANY_NAME]: 'Test Company Name',
      };

      const useTemplateRes = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipients: [
            {
              id: template.recipients[0].id,
              email: 'recipient@example.com',
              name: 'Test Recipient',
            },
          ],
          formValues: testValues,
        },
      });

      expect(useTemplateRes.ok()).toBeTruthy();
      const documentResponse = await useTemplateRes.json();

      const document = await prisma.envelope.findFirstOrThrow({
        where: { id: documentResponse.envelopeId },
        include: {
          envelopeItems: { include: { documentData: true } },
        },
      });

      // The form should be flattened, so we can't read form fields
      const documentPdfBuffer = await getFileServerSide(document.envelopeItems[0].documentData);
      expect(await pdfHasFormFields(documentPdfBuffer)).toBe(false);

      // The values should have been inserted before flattening
      // We can't verify the actual text content easily without visual inspection,
      // but we can verify the form fields are gone (flattened)
      const fieldNames = await getPdfFormFieldNames(documentPdfBuffer);
      expect(fieldNames.length).toBe(0);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle PDF without form fields gracefully', async ({ request }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      // Use a PDF without form fields
      const examplePdf = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

      const payload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'Document with No Form Fields',
        formValues: {
          nonexistent_field: 'Some Value',
        },
      };

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append('files', new File([examplePdf], 'example.pdf', { type: 'application/pdf' }));

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      // Should succeed even with formValues for non-existent fields
      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const response = (await res.json()) as TCreateEnvelopeResponse;
      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: response.id },
        include: {
          envelopeItems: { include: { documentData: true } },
        },
      });

      expect(envelope.formValues).toEqual({ nonexistent_field: 'Some Value' });
    });

    test('should handle empty formValues object', async ({ request }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const payload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'Document with Empty Form Values',
        formValues: {},
      };

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const response = (await res.json()) as TCreateEnvelopeResponse;
      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: response.id },
        include: {
          envelopeItems: { include: { documentData: true } },
        },
      });

      // Form should still be flattened for DOCUMENT type
      const documentData = envelope.envelopeItems[0].documentData;
      const pdfBuffer = await getFileServerSide(documentData);

      expect(await pdfHasFormFields(pdfBuffer)).toBe(false);
    });

    test('should handle partial formValues (only some fields)', async ({ request }) => {
      const { user, team } = await seedUser();
      const { token } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'test',
        expiresIn: null,
      });

      const payload: TCreateEnvelopePayload = {
        type: EnvelopeType.DOCUMENT,
        title: 'Document with Partial Form Values',
        formValues: {
          [FORM_FIELDS.TEXT_FIELD]: 'Only this field',
          // Other fields not set
        },
      };

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append(
        'files',
        new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }),
      );

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const response = (await res.json()) as TCreateEnvelopeResponse;
      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: response.id },
        include: {
          envelopeItems: { include: { documentData: true } },
        },
      });

      // Should store the partial formValues
      expect(envelope.formValues).toEqual({
        [FORM_FIELDS.TEXT_FIELD]: 'Only this field',
      });

      // Form should still be flattened
      const documentData = envelope.envelopeItems[0].documentData;
      const pdfBuffer = await getFileServerSide(documentData);

      expect(await pdfHasFormFields(pdfBuffer)).toBe(false);
    });
  });
});
