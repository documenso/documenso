import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

/**
 * Covers the inline (non-blocking) field properties editor.
 *
 * Previously, opening a field's advanced settings replaced the entire "Add
 * Fields" sidebar, hiding the field-placement controls. The editor now renders
 * as a draggable, collapsible floating panel so the document, the placed fields,
 * and the placement controls all stay visible while properties are edited.
 */
const setupDocumentAndNavigateToFieldsStep = async (page: Page) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  return { user, team, document };
};

const openTextFieldEditor = async (page: Page) => {
  await page.getByRole('button', { name: 'Text' }).click();
  await page.locator(PDF_VIEWER_PAGE_SELECTOR).click({
    position: {
      x: 100,
      y: 150,
    },
  });

  const panel = page.getByTestId('field-advanced-settings-panel');
  await expect(panel).toBeVisible();

  return panel;
};

test.describe('Inline field properties editor', () => {
  test('keeps the placement form and document visible while editing a field', async ({ page }) => {
    await setupDocumentAndNavigateToFieldsStep(page);

    const panel = await openTextFieldEditor(page);

    // The editor no longer takes over the sidebar: the "Add Fields" form and its
    // field-type buttons remain visible alongside the floating panel.
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Signature' })).toBeVisible();

    // The field that is being edited stays rendered on the document.
    await expect(page.locator('[data-field-type="TEXT"]')).toBeVisible();

    // The panel exposes the same field configuration controls.
    await expect(page.getByRole('textbox', { name: 'Field label' })).toBeVisible();

    await expect(panel).toBeVisible();
  });

  test('can be minimized, expanded and closed', async ({ page }) => {
    await setupDocumentAndNavigateToFieldsStep(page);

    const panel = await openTextFieldEditor(page);

    const footer = page.getByTestId('field-advanced-settings-footer');
    await expect(footer).toBeVisible();

    // Minimizing collapses the body and footer, leaving only the panel header.
    await page.getByTestId('field-advanced-settings-collapse').click();
    await expect(footer).toBeHidden();
    await expect(panel).toBeVisible();

    // Expanding restores the body and footer.
    await page.getByTestId('field-advanced-settings-collapse').click();
    await expect(footer).toBeVisible();

    // Closing dismisses the panel without removing the placed field.
    await page.getByTestId('field-advanced-settings-close').click();
    await expect(panel).toBeHidden();

    await expect(page.locator('[data-field-type="TEXT"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
  });

  test('reflects label changes on the document in real time', async ({ page }) => {
    await setupDocumentAndNavigateToFieldsStep(page);

    await openTextFieldEditor(page);

    await page.getByRole('textbox', { name: 'Field label' }).fill('Full name');

    // The preview on the document updates from the panel without saving first.
    await expect(page.locator('[data-field-type="TEXT"]').getByText('Full name')).toBeVisible();
  });
});
