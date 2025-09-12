import { type Page, expect, test } from '@playwright/test';
import type { Document, Team } from '@prisma/client';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

/**
 * Test helper to complete the document creation flow with duplicate recipients
 */
const completeDocumentFlowWithDuplicateRecipients = async (options: {
  page: Page;
  team: Team;
  document: Document;
}) => {
  const { page, team, document } = options;

  // Step 1: Settings - Continue with defaults
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // Step 2: Add duplicate recipients
  await page.getByPlaceholder('Email').fill('duplicate@example.com');
  await page.getByPlaceholder('Name').fill('Duplicate Recipient 1');

  // Add second signer with same email
  await page.getByRole('button', { name: 'Add Signer' }).click();
  await page.getByLabel('Email').nth(1).fill('duplicate@example.com');
  await page.getByLabel('Name').nth(1).fill('Duplicate Recipient 2');

  // Add third signer with different email for comparison
  await page.getByRole('button', { name: 'Add Signer' }).click();
  await page.getByLabel('Email').nth(2).fill('unique@example.com');
  await page.getByLabel('Name').nth(2).fill('Unique Recipient');

  // Continue to fields
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  // Step 3: Add fields for each recipient
  // Add signature field for first duplicate recipient
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({ position: { x: 100, y: 100 } });

  await page.getByText('Duplicate Recipient 1 (duplicate@example.com)').click();

  // Switch to second duplicate recipient and add their field
  await page.getByText('Duplicate Recipient 2 (duplicate@example.com)').click();
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({ position: { x: 200, y: 100 } });

  await page.getByText('Duplicate Recipient 2 (duplicate@example.com)').click();

  // Switch to unique recipient and add their field
  await page.getByText('Unique Recipient (unique@example.com)').click();
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({ position: { x: 300, y: 100 } });

  // Continue to subject
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();

  // Step 4: Complete with subject and send
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Send' }).click();

  // Wait for send confirmation
  await page.waitForURL(`/t/${team.url}/documents`);

  await expect(page.getByRole('link', { name: document.title })).toBeVisible();
};

test.describe('[DOCUMENT_FLOW]: Duplicate Recipients', () => {
  test('should allow creating document with duplicate recipient emails', async ({ page }) => {
    const { user, team } = await seedUser();

    const document = await seedBlankDocument(user, team.id);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
    });

    // Complete the flow
    await completeDocumentFlowWithDuplicateRecipients({
      page,
      team,
      document,
    });

    // Verify document was created successfully
    await expect(page).toHaveURL(new RegExp(`/t/${team.url}/documents`));
  });

  test('should allow adding duplicate recipient after saving document initially', async ({
    page,
  }) => {
    const { user, team } = await seedUser();
    const document = await seedBlankDocument(user, team.id);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
    });

    // Step 1: Settings - Continue with defaults
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

    // Step 2: Add initial recipient
    await page.getByPlaceholder('Email').fill('test@example.com');
    await page.getByPlaceholder('Name').fill('Test Recipient');

    // Continue to fields and add a field
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({ position: { x: 100, y: 100 } });

    // Save the document by going to subject
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();

    // Navigate back to signers to add duplicate
    await page.getByRole('button', { name: 'Go Back' }).click();
    await page.getByRole('button', { name: 'Go Back' }).click();
    await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

    // Add duplicate recipient
    await page.getByRole('button', { name: 'Add Signer' }).click();
    await page.getByLabel('Email').nth(1).fill('test@example.com');
    await page.getByLabel('Name').nth(1).fill('Test Recipient Duplicate');

    // Continue and add field for duplicate
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.waitForTimeout(1000);

    // Switch to duplicate recipient and add field
    await page.getByRole('combobox').first().click();
    await page.getByText('Test Recipient Duplicate (test@example.com)').first().click();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({ position: { x: 200, y: 100 } });

    // Complete the flow
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Send' }).click();

    await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

    await expect(page.getByRole('link', { name: document.title })).toBeVisible();
  });

  test('should isolate fields per recipient token even with duplicate emails', async ({
    page,
    context,
  }) => {
    const { user, team } = await seedUser();

    const document = await seedBlankDocument(user, team.id);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
    });

    // Complete the document flow
    await completeDocumentFlowWithDuplicateRecipients({
      page,
      team,
      document,
    });

    // Navigate to documents list and get the document
    await expect(page).toHaveURL(new RegExp(`/t/${team.url}/documents`));

    const recipients = await prisma.recipient.findMany({
      where: {
        envelopeId: document.id,
      },
    });

    expect(recipients).toHaveLength(3);

    const tokens = recipients.map((r) => r.token);

    expect(new Set(tokens).size).toBe(3); // All tokens should be unique

    // Test each signing experience in separate browser contexts
    for (const recipient of recipients) {
      // Navigate to signing URL
      await page.goto(`/sign/${recipient.token}`, {
        waitUntil: 'networkidle',
      });

      await page.waitForSelector(PDF_VIEWER_PAGE_SELECTOR);

      // Verify only one signature field is visible for this recipient
      expect(
        await page.locator(`[data-field-type="SIGNATURE"]:not([data-readonly="true"])`).all(),
      ).toHaveLength(1);

      // Verify recipient name is correct
      await expect(page.getByLabel('Full Name')).toHaveValue(recipient.name);

      // Sign the document
      await signSignaturePad(page);

      await page
        .locator('[data-field-type="SIGNATURE"]:not([data-readonly="true"])')
        .first()
        .click();

      await page.getByRole('button', { name: 'Complete' }).click();
      await page.getByRole('button', { name: 'Sign' }).click();

      // Verify completion
      await page.waitForURL(`/sign/${recipient?.token}/complete`);
      await expect(page.getByText('Document Signed')).toBeVisible();
    }
  });

  test('should handle duplicate recipient workflow with different field types', async ({
    page,
  }) => {
    const { user, team } = await seedUser();
    const document = await seedBlankDocument(user, team.id);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
    });

    // Step 1: Settings
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Add duplicate recipients with different roles
    await page.getByPlaceholder('Email').fill('signer@example.com');
    await page.getByPlaceholder('Name').fill('Signer Role');

    await page.getByRole('button', { name: 'Add Signer' }).click();
    await page.getByLabel('Email').nth(1).fill('signer@example.com');
    await page.getByLabel('Name').nth(1).fill('Approver Role');

    // Change second recipient role if role selector is available
    const roleDropdown = page.getByLabel('Role').nth(1);

    if (await roleDropdown.isVisible()) {
      await roleDropdown.click();
      await page.getByText('Approver').click();
    }

    // Step 3: Add different field types for each duplicate
    await page.getByRole('button', { name: 'Continue' }).click();

    // Add signature for first recipient
    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({ position: { x: 100, y: 100 } });

    // Add name field for second recipient
    await page.getByRole('combobox').first().click();

    await page.getByText('Approver Role (signer@example.com)').first().click();
    await page.getByRole('button', { name: 'Name' }).click();
    await page.locator('canvas').click({ position: { x: 200, y: 100 } });

    // Add date field for second recipient
    await page.getByRole('button', { name: 'Date' }).click();
    await page.locator('canvas').click({ position: { x: 200, y: 150 } });

    // Complete the document
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByRole('button', { name: 'Send' }).click();

    await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

    await expect(page.getByRole('link', { name: document.title })).toBeVisible();
  });

  test('should preserve field assignments when editing document with duplicates', async ({
    page,
  }) => {
    const { user, team } = await seedUser();
    const document = await seedBlankDocument(user, team.id);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
    });

    // Create document with duplicates and fields
    await completeDocumentFlowWithDuplicateRecipients({
      page,
      team,
      document,
    });

    // Navigate back to edit the document
    await page.goto(`/t/${team.url}/documents/${document.id}/edit`);

    // Go to fields step
    await page.getByRole('button', { name: 'Continue' }).click(); // Settings
    await page.getByRole('button', { name: 'Continue' }).click(); // Signers

    // Verify fields are assigned to correct recipients
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    // Click on first duplicate recipient
    await page.getByText('Duplicate Recipient 1 (duplicate@example.com)').click();

    // Verify their field is visible and can be selected
    const firstRecipientFields = await page
      .locator(`[data-field-type="SIGNATURE"]:not(:disabled)`)
      .all();
    expect(firstRecipientFields.length).toBeGreaterThan(0);

    // Switch to second duplicate recipient
    await page.getByText('Duplicate Recipient 2 (duplicate@example.com)').click();

    // Verify they have their own field
    const secondRecipientFields = await page
      .locator(`[data-field-type="SIGNATURE"]:not(:disabled)`)
      .all();
    expect(secondRecipientFields.length).toBeGreaterThan(0);

    // Add another field to the second duplicate
    await page.getByRole('button', { name: 'Name' }).click();
    await page.locator('canvas').click({ position: { x: 250, y: 150 } });

    // Save changes
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Send' }).click();

    await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

    await expect(page.getByRole('link', { name: document.title })).toBeVisible();
  });
});
