import { seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';
import { clickEnvelopeEditorStep } from '../fixtures/envelope-editor';

const INVALID_DIRECT_TEMPLATE_ALERT_TITLE = 'Invalid direct link template';

/**
 * Place a field on the PDF canvas in the envelope editor.
 */
const placeFieldOnPdf = async (root: Page, fieldName: 'Signature' | 'Text', position: { x: number; y: number }) => {
  await root.getByRole('button', { name: fieldName, exact: true }).click();

  const canvas = root.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible();
  await canvas.click({ position });
};

/**
 * Seed a V2 direct template and open it in the native template editor.
 *
 * Only the native template editor is covered here: direct links only exist
 * for templates and are not part of the embedded editor surfaces.
 */
const openDirectTemplateEditor = async (page: Page, options: { createDirectRecipientSignatureField: boolean }) => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    title: `E2E Direct Template Validation ${Date.now()}`,
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
    createDirectRecipientSignatureField: options.createDirectRecipientSignatureField,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  return { user, team, template };
};

test.describe('template editor', () => {
  test('shows invalid direct template warning when a signer has no signature field', async ({ page }) => {
    await openDirectTemplateEditor(page, { createDirectRecipientSignatureField: false });

    await expect(page.getByText(INVALID_DIRECT_TEMPLATE_ALERT_TITLE)).toBeVisible();
    await expect(page.getByText('are missing a signature field')).toBeVisible();
  });

  test('does not show the warning when all signers have signature fields', async ({ page }) => {
    await openDirectTemplateEditor(page, { createDirectRecipientSignatureField: true });

    // Wait for the editor to render before asserting the banner is absent.
    await expect(page.getByTestId('envelope-editor-step-upload')).toBeVisible();
    await expect(page.getByText(INVALID_DIRECT_TEMPLATE_ALERT_TITLE)).not.toBeVisible();
  });

  test('warning disappears after placing a signature field', async ({ page }) => {
    await openDirectTemplateEditor(page, { createDirectRecipientSignatureField: false });

    await expect(page.getByText(INVALID_DIRECT_TEMPLATE_ALERT_TITLE)).toBeVisible();

    // Place a signature field for the direct recipient (auto-selected single recipient).
    await clickEnvelopeEditorStep(page, 'addFields');
    await expect(page.locator('.konva-container canvas').first()).toBeVisible();
    await placeFieldOnPdf(page, 'Signature', { x: 120, y: 140 });

    // The banner clears once the field is autosaved and the envelope state updates.
    await expect(page.getByText(INVALID_DIRECT_TEMPLATE_ALERT_TITLE)).not.toBeVisible({ timeout: 15_000 });
  });
});
