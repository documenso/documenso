import { type Page, expect, test } from '@playwright/test';
import { EnvelopeType, FieldType, RecipientRole } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TCreateEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';

import { apiSignin } from '../fixtures/authentication';
import {
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getRecipientEmailInputs,
  openDocumentEnvelopeEditor,
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
 * Create a V2 document envelope via the API with a single SIGNER recipient
 * and a SIGNATURE field, suitable for testing save-as-template with data.
 *
 * Returns the envelope ID, user, team, and recipient email.
 */
const createDocumentWithRecipientAndField = async () => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: `e2e-save-as-template-${Date.now()}`,
    expiresIn: null,
  });

  const recipientEmail = `save-template-${Date.now()}@test.documenso.com`;

  // 1. Create envelope with a PDF.
  const payload = {
    type: EnvelopeType.DOCUMENT,
    title: `E2E Save as Template ${Date.now()}`,
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
        name: 'Template Test Signer',
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

  return {
    user,
    team,
    envelopeId: createResponse.id,
    recipientEmail,
  };
};

test.describe('document editor', () => {
  test('save document as template from editor sidebar', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    // Add the current user as a recipient via the UI.
    await clickAddMyselfButton(surface.root);
    await expect(getRecipientEmailInputs(surface.root).first()).toHaveValue(surface.userEmail);

    // Navigate to the add fields step and place a signature field.
    await clickEnvelopeEditorStep(surface.root, 'addFields');
    await expect(surface.root.locator('.konva-container canvas').first()).toBeVisible();
    await placeFieldOnPdf(surface.root, 'Signature', { x: 120, y: 140 });

    // Navigate back to the upload step so the sidebar actions are available.
    await clickEnvelopeEditorStep(surface.root, 'upload');

    // Click the "Save as Template" sidebar action.
    await page.locator('button[title="Save as Template"]').click();

    // The save as template dialog should appear.
    await expect(page.getByRole('heading', { name: 'Save as Template' })).toBeVisible();

    // Both checkboxes should be checked by default.
    await expect(page.locator('#envelopeIncludeRecipients')).toBeChecked();
    await expect(page.locator('#envelopeIncludeFields')).toBeChecked();

    // Click "Save as Template".
    await page.getByRole('button', { name: 'Save as Template' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Template Created');

    // The page should have navigated to the new template's edit page.
    await expect(page).toHaveURL(/\/templates\/.*\/edit/);

    // Verify the new template envelope was created in the database with correct type and secondaryId.
    const templateEnvelopes = await prisma.envelope.findMany({
      where: {
        userId: surface.userId,
        teamId: surface.teamId,
        type: 'TEMPLATE',
      },
      include: {
        recipients: {
          include: {
            fields: true,
          },
        },
      },
    });

    expect(templateEnvelopes.length).toBeGreaterThanOrEqual(1);

    const createdTemplate = templateEnvelopes.find((e) => e.title.includes('(copy)'));
    expect(createdTemplate).toBeDefined();

    // CRITICAL: Verify the secondaryId uses the template_ prefix, not document_.
    // This confirms incrementTemplateId was called, not incrementDocumentId.
    expect(createdTemplate!.secondaryId).toMatch(/^template_\d+$/);
    expect(createdTemplate!.type).toBe(EnvelopeType.TEMPLATE);

    // Verify recipients were included.
    expect(createdTemplate!.recipients.length).toBe(1);
    expect(createdTemplate!.recipients[0].email).toBe(surface.userEmail);

    // Verify fields were included.
    expect(createdTemplate!.recipients[0].fields.length).toBe(1);
    expect(createdTemplate!.recipients[0].fields[0].type).toBe(FieldType.SIGNATURE);
  });

  test('save document as template without recipients', async ({ page }) => {
    const { user, team, envelopeId, recipientEmail } = await createDocumentWithRecipientAndField();

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${envelopeId}/edit`,
    });

    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // Click the "Save as Template" sidebar action.
    await page.locator('button[title="Save as Template"]').click();

    // The dialog should appear.
    await expect(page.getByRole('heading', { name: 'Save as Template' })).toBeVisible();

    // Uncheck "Include Recipients" - "Include Fields" should auto-disable.
    await page.locator('#envelopeIncludeRecipients').click();
    await expect(page.locator('#envelopeIncludeRecipients')).not.toBeChecked();
    await expect(page.locator('#envelopeIncludeFields')).not.toBeChecked();
    await expect(page.locator('#envelopeIncludeFields')).toBeDisabled();

    // Click "Save as Template".
    await page.getByRole('button', { name: 'Save as Template' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Template Created');

    // The page should have navigated to the new template's edit page.
    await expect(page).toHaveURL(/\/templates\/.*\/edit/);

    // Verify the template was created without recipients.
    const templateEnvelopes = await prisma.envelope.findMany({
      where: {
        userId: user.id,
        teamId: team.id,
        type: 'TEMPLATE',
      },
      include: {
        recipients: true,
      },
    });

    const createdTemplate = templateEnvelopes.find((e) => e.title.includes('(copy)'));
    expect(createdTemplate).toBeDefined();

    // CRITICAL: Verify the secondaryId uses the template_ prefix.
    expect(createdTemplate!.secondaryId).toMatch(/^template_\d+$/);

    // Verify no recipients were included.
    expect(createdTemplate!.recipients.length).toBe(0);
  });

  test('save document as template without fields but with recipients', async ({ page }) => {
    const { user, team, envelopeId, recipientEmail } = await createDocumentWithRecipientAndField();

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${envelopeId}/edit`,
    });

    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // Click the "Save as Template" sidebar action.
    await page.locator('button[title="Save as Template"]').click();

    // The dialog should appear.
    await expect(page.getByRole('heading', { name: 'Save as Template' })).toBeVisible();

    // Uncheck "Include Fields" but keep "Include Recipients".
    await page.locator('#envelopeIncludeFields').click();
    await expect(page.locator('#envelopeIncludeRecipients')).toBeChecked();
    await expect(page.locator('#envelopeIncludeFields')).not.toBeChecked();

    // Click "Save as Template".
    await page.getByRole('button', { name: 'Save as Template' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Template Created');

    // The page should have navigated to the new template's edit page.
    await expect(page).toHaveURL(/\/templates\/.*\/edit/);

    // Verify the template was created with recipients but no fields.
    const templateEnvelopes = await prisma.envelope.findMany({
      where: {
        userId: user.id,
        teamId: team.id,
        type: 'TEMPLATE',
      },
      include: {
        recipients: {
          include: {
            fields: true,
          },
        },
      },
    });

    const createdTemplate = templateEnvelopes.find((e) => e.title.includes('(copy)'));
    expect(createdTemplate).toBeDefined();

    // CRITICAL: Verify the secondaryId uses the template_ prefix.
    expect(createdTemplate!.secondaryId).toMatch(/^template_\d+$/);

    // Verify recipients were included.
    expect(createdTemplate!.recipients.length).toBe(1);
    expect(createdTemplate!.recipients[0].email).toBe(recipientEmail);

    // Verify no fields were included.
    expect(createdTemplate!.recipients[0].fields.length).toBe(0);
  });
});

test.describe('documents table', () => {
  test('save as template from document row dropdown', async ({ page }) => {
    const { user, team, envelopeId, recipientEmail } = await createDocumentWithRecipientAndField();

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Wait for the documents table to load.
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // Click the actions dropdown for the document row.
    await page.getByTestId('document-table-action-btn').first().click();

    // Click "Save as Template" in the dropdown.
    await page.getByRole('menuitem', { name: 'Save as Template' }).click();

    // The dialog should appear.
    await expect(page.getByRole('heading', { name: 'Save as Template' })).toBeVisible();

    // Click "Save as Template".
    await page.getByRole('button', { name: 'Save as Template' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Template Created');

    // The page should have navigated to the new template's edit page.
    await expect(page).toHaveURL(/\/templates\/.*\/edit/);

    // Verify the template was created with correct type and secondaryId.
    const templateEnvelopes = await prisma.envelope.findMany({
      where: {
        userId: user.id,
        teamId: team.id,
        type: 'TEMPLATE',
      },
      include: {
        recipients: {
          include: {
            fields: true,
          },
        },
      },
    });

    const createdTemplate = templateEnvelopes.find((e) => e.title.includes('(copy)'));
    expect(createdTemplate).toBeDefined();

    // CRITICAL: Verify the secondaryId uses the template_ prefix.
    expect(createdTemplate!.secondaryId).toMatch(/^template_\d+$/);
    expect(createdTemplate!.type).toBe(EnvelopeType.TEMPLATE);

    // Verify recipients and fields were included (defaults are both checked).
    expect(createdTemplate!.recipients.length).toBe(1);
    expect(createdTemplate!.recipients[0].fields.length).toBe(1);
  });
});

test.describe('document index page', () => {
  test('save as template from document page dropdown', async ({ page }) => {
    const { user, team, envelopeId, recipientEmail } = await createDocumentWithRecipientAndField();

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${envelopeId}`,
    });

    // Wait for the document page to load.
    await expect(page.getByRole('heading', { name: /E2E Save as Template/ })).toBeVisible();

    // Click the more actions dropdown trigger.
    await page.getByTestId('document-page-view-action-btn').click();

    // Click "Save as Template" in the dropdown.
    await page.getByRole('menuitem', { name: 'Save as Template' }).click();

    // The dialog should appear.
    await expect(page.getByRole('heading', { name: 'Save as Template' })).toBeVisible();

    // Click "Save as Template".
    await page.getByRole('button', { name: 'Save as Template' }).click();

    // Assert toast appears.
    await expectToastTextToBeVisible(page, 'Template Created');

    // The page should have navigated to the new template's edit page.
    await expect(page).toHaveURL(/\/templates\/.*\/edit/);

    // Verify the template was created with correct type and secondaryId.
    const templateEnvelopes = await prisma.envelope.findMany({
      where: {
        userId: user.id,
        teamId: team.id,
        type: 'TEMPLATE',
      },
    });

    const createdTemplate = templateEnvelopes.find((e) => e.title.includes('(copy)'));
    expect(createdTemplate).toBeDefined();

    // CRITICAL: Verify the secondaryId uses the template_ prefix.
    expect(createdTemplate!.secondaryId).toMatch(/^template_\d+$/);
    expect(createdTemplate!.type).toBe(EnvelopeType.TEMPLATE);
  });
});

test.describe('legacy ID correctness', () => {
  test('save as template uses template counter, not document counter', async ({ page }) => {
    // Record the current counter values before the operation.
    const [documentCounterBefore, templateCounterBefore] = await Promise.all([
      prisma.counter.findUnique({ where: { id: 'document' } }),
      prisma.counter.findUnique({ where: { id: 'template' } }),
    ]);

    const surface = await openDocumentEnvelopeEditor(page);

    // Click the "Save as Template" sidebar action.
    await page.locator('button[title="Save as Template"]').click();
    await expect(page.getByRole('heading', { name: 'Save as Template' })).toBeVisible();

    // Click "Save as Template".
    await page.getByRole('button', { name: 'Save as Template' }).click();
    await expectToastTextToBeVisible(page, 'Template Created');
    await expect(page).toHaveURL(/\/templates\/.*\/edit/);

    // Record the counter values after the operation.
    const [documentCounterAfter, templateCounterAfter] = await Promise.all([
      prisma.counter.findUnique({ where: { id: 'document' } }),
      prisma.counter.findUnique({ where: { id: 'template' } }),
    ]);

    // The template counter MUST have incremented (at least once - could be more due to
    // the seedBlankDocument call in openDocumentEnvelopeEditor seeding other templates).
    expect(templateCounterAfter!.value).toBeGreaterThan(templateCounterBefore!.value);

    // Verify the created template's secondaryId matches the template counter.
    const createdTemplate = await prisma.envelope.findFirst({
      where: {
        userId: surface.userId,
        teamId: surface.teamId,
        type: 'TEMPLATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(createdTemplate).not.toBeNull();
    expect(createdTemplate!.secondaryId).toBe(`template_${templateCounterAfter!.value}`);
    expect(createdTemplate!.secondaryId).not.toMatch(/^document_/);
  });
});
