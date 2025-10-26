import { type Page, expect, test } from '@playwright/test';
import type { Envelope, Team } from '@prisma/client';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { prisma } from '@documenso/prisma';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

/**
 * Test helper to complete template creation with duplicate recipients
 */
const completeTemplateFlowWithDuplicateRecipients = async (options: {
  page: Page;
  team: Team;
  template: Envelope;
}) => {
  const { page, team, template } = options;
  // Step 1: Settings - Continue with defaults
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

  // Step 2: Add duplicate recipients with real emails for testing
  await page.getByPlaceholder('Email').fill('duplicate@example.com');
  await page.getByPlaceholder('Name').fill('First Instance');

  // Add second signer with same email
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
  await page.getByPlaceholder('Email').nth(1).fill('duplicate@example.com');
  await page.getByPlaceholder('Name').nth(1).fill('Second Instance');

  // Add third signer with different email
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
  await page.getByPlaceholder('Email').nth(2).fill('unique@example.com');
  await page.getByPlaceholder('Name').nth(2).fill('Different Recipient');

  // Continue to fields
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  // Step 3: Add fields for each recipient instance
  // Add signature field for first instance
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({ position: { x: 100, y: 100 } });

  // Switch to second instance and add their field
  await page.getByRole('combobox').first().click();
  await page.getByText('Second Instance').first().click();
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({ position: { x: 200, y: 100 } });

  // Switch to different recipient and add their field
  await page.getByRole('combobox').first().click();
  await page.getByText('Different Recipient').first().click();
  await page.getByRole('button', { name: 'Name' }).click();
  await page.locator('canvas').click({ position: { x: 300, y: 100 } });

  // Save template
  await page.getByRole('button', { name: 'Save Template' }).click();

  // Wait for creation confirmation
  await page.waitForURL(`/t/${team.url}/templates`);
  await expect(page.getByRole('link', { name: template.title })).toBeVisible();
};

test.describe('[TEMPLATE_FLOW]: Duplicate Recipients', () => {
  test('should allow creating template with duplicate recipient emails', async ({ page }) => {
    const { user, team } = await seedUser();

    const template = await seedBlankTemplate(user, team.id);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
    });

    // Complete the template flow
    await completeTemplateFlowWithDuplicateRecipients({ page, team, template });

    // Verify template was created successfully
    await expect(page).toHaveURL(`/t/${team.url}/templates`);
  });

  test('should create document from template with duplicate recipients using same email', async ({
    page,
    context,
  }) => {
    const { user, team } = await seedUser();

    const template = await seedBlankTemplate(user, team.id);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
    });

    // Complete template creation
    await completeTemplateFlowWithDuplicateRecipients({ page, team, template });

    // Navigate to template and create document
    await page.goto(`/t/${team.url}/templates`);

    await page
      .getByRole('row', { name: template.title })
      .getByRole('button', { name: 'Use Template' })
      .click();

    // Fill recipient information with same email for both instances
    await expect(page.getByRole('heading', { name: 'Create document' })).toBeVisible();

    // Set same email for both recipient instances
    const emailInputs = await page.locator('[aria-label="Email"]').all();
    const nameInputs = await page.locator('[aria-label="Name"]').all();

    // First instance
    await emailInputs[0].fill('same@example.com');
    await nameInputs[0].fill('John Doe - Role 1');

    // Second instance (same email)
    await emailInputs[1].fill('same@example.com');
    await nameInputs[1].fill('John Doe - Role 2');

    // Different recipient
    await emailInputs[2].fill('different@example.com');
    await nameInputs[2].fill('Jane Smith');

    await page.getByLabel('Send document').click();

    // Create document
    await page.getByRole('button', { name: 'Create and send' }).click();
    await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

    // Get the document ID from URL for database queries
    const url = page.url();
    const documentIdMatch = url.match(/\/documents\/envelope_(.*)/);

    const envelopeId = documentIdMatch ? documentIdMatch[1] : null;

    expect(envelopeId).not.toBeNull();

    // Get recipients directly from database
    const recipients = await prisma.recipient.findMany({
      where: {
        envelopeId: `envelope_${envelopeId}`,
      },
    });

    expect(recipients).toHaveLength(3);

    // Verify all tokens are unique
    const tokens = recipients.map((r) => r.token);
    expect(new Set(tokens).size).toBe(3);

    // Test signing experience for duplicate email recipients
    const duplicateRecipients = recipients.filter((r) => r.email === 'same@example.com');
    expect(duplicateRecipients).toHaveLength(2);

    for (const recipient of duplicateRecipients) {
      // Navigate to signing URL
      await page.goto(`/sign/${recipient.token}`, {
        waitUntil: 'networkidle',
      });

      await page.waitForSelector(PDF_VIEWER_PAGE_SELECTOR);

      // Verify correct recipient name is shown
      await expect(page.getByLabel('Full Name')).toHaveValue(recipient.name);

      // Verify only one signature field is visible for this recipient
      expect(
        await page.locator(`[data-field-type="SIGNATURE"]:not([data-readonly="true"])`).all(),
      ).toHaveLength(1);
    }
  });

  test('should handle template with different types of duplicate emails', async ({ page }) => {
    const { user, team } = await seedUser();

    const template = await seedBlankTemplate(user, team.id);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
    });

    // Step 1: Settings
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Add multiple recipients with duplicate emails
    await page.getByPlaceholder('Email').fill('duplicate@example.com');
    await page.getByPlaceholder('Name').fill('Duplicate Recipient 1');

    await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
    await page.getByPlaceholder('Email').nth(1).fill('duplicate@example.com');
    await page.getByPlaceholder('Name').nth(1).fill('Duplicate Recipient 2');

    await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
    await page.getByPlaceholder('Email').nth(2).fill('different@example.com');
    await page.getByPlaceholder('Name').nth(2).fill('Different Recipient');

    // Continue and add fields
    await page.getByRole('button', { name: 'Continue' }).click();

    // Add fields for each recipient
    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({ position: { x: 100, y: 100 } });

    await page.getByRole('combobox').first().click();
    await page.getByText('Duplicate Recipient 2').first().click();
    await page.getByRole('button', { name: 'Date' }).click();
    await page.locator('canvas').click({ position: { x: 200, y: 100 } });

    await page.getByRole('combobox').first().click();
    await page.getByText('Different Recipient').first().click();
    await page.getByRole('button', { name: 'Name' }).click();
    await page.locator('canvas').click({ position: { x: 100, y: 200 } });

    // Save template
    await page.getByRole('button', { name: 'Save Template' }).click();

    await page.waitForURL(`/t/${team.url}/templates`);

    await expect(page.getByRole('link', { name: template.title })).toBeVisible();
  });

  test('should validate field assignments per recipient in template editing', async ({ page }) => {
    const { user, team } = await seedUser();

    const template = await seedBlankTemplate(user, team.id);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
    });

    // Create template with duplicates
    await completeTemplateFlowWithDuplicateRecipients({ page, team, template });

    // Navigate back to edit the template
    await page.goto(`/t/${team.url}/templates/${template.id}/edit`);

    // Go to fields step
    await page.getByRole('button', { name: 'Continue' }).click(); // Settings
    await page.getByRole('button', { name: 'Continue' }).click(); // Signers

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    // Verify fields are correctly assigned to each recipient instance
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'First Instance' }).first().click();
    let visibleFields = await page.locator(`[data-field-type="SIGNATURE"]:not(:disabled)`).all();
    expect(visibleFields.length).toBeGreaterThan(0);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Second Instance' }).first().click();
    visibleFields = await page.locator(`[data-field-type="SIGNATURE"]:not(:disabled)`).all();
    expect(visibleFields.length).toBeGreaterThan(0);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Different Recipient' }).first().click();
    const nameFields = await page.locator(`[data-field-type="NAME"]:not(:disabled)`).all();
    expect(nameFields.length).toBeGreaterThan(0);

    // Add additional field to verify proper assignment
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'First Instance' }).first().click();
    await page.getByRole('button', { name: 'Name' }).click();
    await page.locator('canvas').click({ position: { x: 100, y: 300 } });

    await page.waitForTimeout(2500);

    // Save changes
    await page.getByRole('button', { name: 'Save Template' }).click();

    await page.waitForURL(`/t/${team.url}/templates`);
    await expect(page.getByRole('link', { name: template.title })).toBeVisible();
  });
});
