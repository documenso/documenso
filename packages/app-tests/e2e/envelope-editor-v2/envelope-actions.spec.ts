import { type Page, expect, test } from '@playwright/test';
import { DocumentStatus, EnvelopeType, FieldType, RecipientRole } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { seedTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TDistributeEnvelopeRequest } from '@documenso/trpc/server/envelope-router/distribute-envelope.types';
import type { TCreateEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';

import { apiSignin } from '../fixtures/authentication';
import {
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getRecipientEmailInputs,
  openDocumentEnvelopeEditor,
  openTemplateEnvelopeEditor,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const V2_API_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

/**
 * Place a field on the PDF canvas in the envelope editor.
 */
const placeFieldOnPdf = async (
  root: Page,
  fieldName: 'Signature' | 'Text',
  position: { x: number; y: number },
) => {
  await root.getByRole('button', { name: fieldName, exact: true }).click();

  const canvas = root.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible();
  await canvas.click({ position });
};

/**
 * Create a PENDING envelope via the V2 API with a single SIGNER recipient
 * and a SIGNATURE field, then distribute it.
 *
 * Returns the envelope ID, recipient email, team URL, and user info for navigation.
 */
const createPendingEnvelopeViaApi = async () => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'e2e-resend-test',
    expiresIn: null,
  });

  const recipientEmail = `resend-${Date.now()}@test.documenso.com`;

  // 1. Create envelope with a PDF.
  const payload = {
    type: EnvelopeType.DOCUMENT,
    title: `E2E Resend Test ${Date.now()}`,
  } satisfies TCreateEnvelopePayload;

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  formData.append(
    'files',
    new File([examplePdfBuffer], 'example.pdf', { type: 'application/pdf' }),
  );

  const createRes = await fetch(`${V2_API_BASE_URL}/envelope/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  expect(createRes.ok).toBeTruthy();
  const createResponse = (await createRes.json()) as TCreateEnvelopeResponse;

  // 2. Create a SIGNER recipient.
  const createRecipientsRequest: TCreateEnvelopeRecipientsRequest = {
    envelopeId: createResponse.id,
    data: [
      {
        email: recipientEmail,
        name: 'Resend Test Signer',
        role: RecipientRole.SIGNER,
        accessAuth: [],
        actionAuth: [],
      },
    ],
  };

  const recipientsRes = await fetch(`${V2_API_BASE_URL}/envelope/recipient/create-many`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createRecipientsRequest),
  });

  expect(recipientsRes.ok).toBeTruthy();
  const recipientsResponse = await recipientsRes.json();
  const recipients = recipientsResponse.data;

  // 3. Get envelope to find the envelope item ID.
  const getRes = await fetch(`${V2_API_BASE_URL}/envelope/${createResponse.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const envelope = (await getRes.json()) as TGetEnvelopeResponse;
  const envelopeItem = envelope.envelopeItems[0];

  // 4. Create a SIGNATURE field for the recipient.
  const createFieldsRequest = {
    envelopeId: createResponse.id,
    data: [
      {
        recipientId: recipients[0].id,
        envelopeItemId: envelopeItem.id,
        type: FieldType.SIGNATURE,
        page: 1,
        positionX: 100,
        positionY: 100,
        width: 50,
        height: 50,
      },
    ],
  };

  const fieldsRes = await fetch(`${V2_API_BASE_URL}/envelope/field/create-many`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createFieldsRequest),
  });

  expect(fieldsRes.ok).toBeTruthy();

  // 5. Distribute the envelope.
  const distributeRes = await fetch(`${V2_API_BASE_URL}/envelope/distribute`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      envelopeId: createResponse.id,
    } satisfies TDistributeEnvelopeRequest),
  });

  expect(distributeRes.ok).toBeTruthy();

  return {
    user,
    team,
    envelopeId: createResponse.id,
    recipientEmail,
  };
};

test.describe('document editor', () => {
  test('send document via email', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    // Add the current user as a recipient via the UI.
    await clickAddMyselfButton(surface.root);
    await expect(getRecipientEmailInputs(surface.root).first()).toHaveValue(surface.userEmail);

    // Navigate to the add fields step and place a signature field.
    await clickEnvelopeEditorStep(surface.root, 'addFields');
    await expect(surface.root.getByText('Selected Recipient')).toBeVisible();
    await expect(surface.root.locator('.konva-container canvas').first()).toBeVisible();

    await placeFieldOnPdf(surface.root, 'Signature', { x: 120, y: 140 });
    await expect(surface.root.getByText('1 Field')).toBeVisible();

    // Navigate back to the recipients step so the sidebar actions are available.
    await clickEnvelopeEditorStep(surface.root, 'upload');

    // Click the "Send Document" sidebar action.
    await page.locator('button[title="Send Envelope"]').click();

    // The distribute dialog should appear.
    await expect(page.getByRole('heading', { name: 'Send Document' })).toBeVisible();

    // Click Send.
    await page.getByRole('button', { name: 'Send' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Envelope distributed');

    // Assert the document status was changed in the database.
    const updatedEnvelope = await prisma.envelope.findUniqueOrThrow({
      where: { id: surface.envelopeId },
    });

    expect(updatedEnvelope.status).toBe(DocumentStatus.PENDING);
  });

  test('send document shows validation when signers lack signature fields', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    // Add the current user as a SIGNER recipient via the UI — but do NOT place any fields.
    await clickAddMyselfButton(surface.root);
    await expect(getRecipientEmailInputs(surface.root).first()).toHaveValue(surface.userEmail);

    // Click the "Send Document" sidebar action without placing signature fields.
    await page.locator('button[title="Send Envelope"]').click();

    // The distribute dialog should appear.
    await expect(page.getByRole('heading', { name: 'Send Document' })).toBeVisible();

    // The validation warning should be shown instead of the send form.
    await expect(
      page.getByText('The following signers are missing signature fields'),
    ).toBeVisible();

    // The "Send" button should not be visible since we're in validation mode.
    await expect(page.getByRole('button', { name: 'Send', exact: true })).not.toBeVisible();

    // Close the dialog.
    await page.getByRole('button', { name: 'Close' }).click();

    // The dialog should be closed.
    await expect(
      page.getByText('The following signers are missing signature fields'),
    ).not.toBeVisible();
  });

  test('resend document sends reminder', async ({ page }) => {
    const { user, team, envelopeId, recipientEmail } = await createPendingEnvelopeViaApi();

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${envelopeId}/edit`,
    });

    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // Click the "Resend Document" sidebar action.
    await page.locator('button[title="Resend Envelope"]').click();

    // The redistribute dialog should appear.
    await expect(page.getByRole('heading', { name: 'Resend Document' })).toBeVisible();

    // The unsigned recipient should be listed.
    await expect(page.getByText(recipientEmail)).toBeVisible();

    // Select the recipient checkbox.
    await page.getByRole('checkbox').first().click();

    // Click "Send reminder".
    await page.getByRole('button', { name: 'Send reminder' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Envelope resent');

    // Verify a resend audit log entry was created in the database.
    const auditLog = await prisma.documentAuditLog.findFirst({
      where: {
        envelopeId,
        type: 'EMAIL_SENT',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditLog).not.toBeNull();
    expect((auditLog!.data as Record<string, unknown>).isResending).toBe(true);
    expect((auditLog!.data as Record<string, unknown>).recipientEmail).toBe(recipientEmail);
  });

  test('duplicate document', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    // Click the "Duplicate Document" sidebar action.
    await page.locator('button[title="Duplicate Envelope"]').click();

    // The duplicate dialog should appear.
    await expect(page.getByRole('heading', { name: 'Duplicate Document' })).toBeVisible();

    // Click "Duplicate".
    await page.getByRole('button', { name: 'Duplicate' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Document Duplicated');

    // The page should have navigated to the new document's edit page.
    await expect(page).toHaveURL(/\/documents\/.*\/edit/);

    // Verify a new envelope was created in the database.
    const envelopes = await prisma.envelope.findMany({
      where: {
        userId: surface.userId,
        teamId: surface.teamId,
        type: 'DOCUMENT',
      },
    });

    // Should have original + duplicate.
    expect(envelopes.length).toBeGreaterThanOrEqual(2);
  });

  test('download PDF dialog shows envelope items', async ({ page }) => {
    await openDocumentEnvelopeEditor(page);

    // Click the "Download PDF" sidebar action.
    await page.locator('button[title="Download PDF"]').click();

    // The download dialog should appear.
    await expect(page.getByRole('heading', { name: 'Download Files' })).toBeVisible();
    await expect(page.getByText('Select the files you would like to download.')).toBeVisible();

    // At least one envelope item with an "Original" download button should be listed.
    await expect(page.getByRole('button', { name: 'Original' }).first()).toBeVisible();
  });

  test('delete draft document', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const documentId = surface.envelopeId;

    // Click the "Delete Document" sidebar action.
    await page.locator('button[title="Delete Envelope"]').click();

    // The delete dialog should appear.
    await expect(page.getByRole('heading', { name: 'Are you sure?' })).toBeVisible();

    // For DRAFT documents no confirmation input is needed, just click "Delete".
    await page.getByRole('button', { name: 'Delete' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Document deleted');

    // The page should navigate back to the documents list.
    await expect(page).toHaveURL(/\/documents$/);

    // Verify the document was deleted from the database.
    const deletedDocument = await prisma.envelope.findUnique({
      where: { id: documentId },
    });

    expect(deletedDocument).toBeNull();
  });
});

test.describe('template editor', () => {
  test('create and manage direct link', async ({ page }) => {
    const { user, team } = await seedUser();

    // seedTemplate creates a template with a SIGNER recipient.
    const template = await seedTemplate({
      title: `E2E Direct Link Template ${Date.now()}`,
      userId: user.id,
      teamId: team.id,
      internalVersion: 2,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
    });

    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // Click the "Direct Link" sidebar action.
    await page.locator('button[title="Direct Link"]').click();

    // The onboarding dialog should appear.
    await expect(page.getByRole('heading', { name: 'Create Direct Signing Link' })).toBeVisible();

    // Click "Enable direct link signing" to proceed.
    await page.getByRole('button', { name: 'Enable direct link signing' }).click();

    // Select recipient step: click "Create one automatically".
    await page.getByRole('button', { name: 'Create one automatically' }).click();

    // Manage step should appear.
    await expect(page.getByRole('heading', { name: 'Direct Link Signing' })).toBeVisible();

    // The shareable link input should be present.
    await expect(page.locator('#copy-direct-link')).toBeVisible();

    // Click "Save" to persist the toggle state.
    await page.getByRole('button', { name: 'Save' }).click();

    // Assert success toast.
    await expectToastTextToBeVisible(page, 'Success');

    // Verify a TemplateDirectLink was created and enabled in the database.
    const directLink = await prisma.templateDirectLink.findFirst({
      where: { envelopeId: template.id },
    });

    expect(directLink).not.toBeNull();
    expect(directLink!.enabled).toBe(true);
  });

  test('duplicate template', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    // Click the "Duplicate Template" sidebar action.
    await page.locator('button[title="Duplicate Envelope"]').click();

    // The duplicate dialog should appear.
    await expect(page.getByRole('heading', { name: 'Duplicate Template' })).toBeVisible();

    // Click "Duplicate".
    await page.getByRole('button', { name: 'Duplicate' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Template Duplicated');

    // The page should have navigated to the new template's edit page.
    await expect(page).toHaveURL(/\/templates\/.*\/edit/);

    // Verify a new envelope was created in the database.
    const envelopes = await prisma.envelope.findMany({
      where: {
        userId: surface.userId,
        teamId: surface.teamId,
        type: 'TEMPLATE',
      },
    });

    // Should have original + duplicate.
    expect(envelopes.length).toBeGreaterThanOrEqual(2);
  });
});
