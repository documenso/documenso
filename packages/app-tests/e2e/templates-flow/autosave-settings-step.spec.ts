import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const setupTemplate = async (page: Page) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  return { user, template };
};

const triggerAutosave = async (page: Page) => {
  await page.locator('#document-flow-form-container').click();
  await page.waitForTimeout(3000);
};

test.describe('AutoSave Settings Step - Templates', () => {
  test('should autosave the title change', async ({ page }) => {
    const { user, template } = await setupTemplate(page);

    const newTemplateTitle = 'New Template Title';

    await page.getByRole('textbox', { name: 'Title *' }).fill(newTemplateTitle);

    await triggerAutosave(page);

    const templateDataFromDB = await getTemplateById({
      id: template.id,
      userId: user.id,
    });

    await expect(page.getByRole('textbox', { name: 'Title *' })).toHaveValue(
      templateDataFromDB.title,
    );
  });

  test('should autosave the language change', async ({ page }) => {
    const { user, template } = await setupTemplate(page);

    const newTemplateLanguage = 'French';
    const expectedLanguageCode = 'fr';

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: newTemplateLanguage }).click();

    await triggerAutosave(page);

    const templateDataFromDB = await getTemplateById({
      id: template.id,
      userId: user.id,
    });

    expect(templateDataFromDB.templateMeta?.language).toBe(expectedLanguageCode);
  });

  test('should autosave the template access change', async ({ page }) => {
    const { user, template } = await setupTemplate(page);

    const access = 'Require account';
    const accessValue = 'ACCOUNT';

    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: access }).click();

    await triggerAutosave(page);

    const templateDataFromDB = await getTemplateById({
      id: template.id,
      userId: user.id,
    });

    expect(templateDataFromDB.authOptions?.globalAccessAuth).toBe(accessValue);
  });

  test('should autosave the external ID change', async ({ page }) => {
    const { user, template } = await setupTemplate(page);

    const newExternalId = '1234567890';

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('textbox', { name: 'External ID' }).fill(newExternalId);

    await triggerAutosave(page);

    const templateDataFromDB = await getTemplateById({
      id: template.id,
      userId: user.id,
    });

    expect(templateDataFromDB.externalId).toBe(newExternalId);
  });

  test('should autosave the allowed signature types change', async ({ page }) => {
    const { user, template } = await setupTemplate(page);

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('combobox').nth(3).click();
    await page.getByRole('option', { name: 'Draw' }).click();
    await page.getByRole('option', { name: 'Type' }).click();

    await triggerAutosave(page);

    const templateDataFromDB = await getTemplateById({
      id: template.id,
      userId: user.id,
    });

    expect(templateDataFromDB.templateMeta?.drawSignatureEnabled).toBe(false);
    expect(templateDataFromDB.templateMeta?.typedSignatureEnabled).toBe(false);
    expect(templateDataFromDB.templateMeta?.uploadSignatureEnabled).toBe(true);
  });

  test('should autosave the date format change', async ({ page }) => {
    const { user, template } = await setupTemplate(page);

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('combobox').nth(4).click();
    await page.getByRole('option', { name: 'ISO 8601' }).click();

    await triggerAutosave(page);

    const templateDataFromDB = await getTemplateById({
      id: template.id,
      userId: user.id,
    });

    expect(templateDataFromDB.templateMeta?.dateFormat).toBe("yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
  });

  test('should autosave the timezone change', async ({ page }) => {
    const { user, template } = await setupTemplate(page);

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('combobox').nth(5).click();
    await page.getByRole('option', { name: 'Europe/London' }).click();

    await triggerAutosave(page);

    const templateDataFromDB = await getTemplateById({
      id: template.id,
      userId: user.id,
    });

    expect(templateDataFromDB.templateMeta?.timezone).toBe('Europe/London');
  });

  test('should autosave the redirect URL change', async ({ page }) => {
    const { user, template } = await setupTemplate(page);

    const newRedirectUrl = 'https://documenso.com/test/';

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('textbox', { name: 'Redirect URL' }).fill(newRedirectUrl);

    await triggerAutosave(page);

    const templateDataFromDB = await getTemplateById({
      id: template.id,
      userId: user.id,
    });

    expect(templateDataFromDB.templateMeta?.redirectUrl).toBe(newRedirectUrl);
  });

  test('should autosave multiple field changes together', async ({ page }) => {
    const { user, template } = await setupTemplate(page);

    const newTitle = 'Updated Template Title';
    await page.getByRole('textbox', { name: 'Title *' }).fill(newTitle);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'German' }).click();

    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Require account' }).click();

    await page.getByRole('button', { name: 'Advanced Options' }).click();
    const newExternalId = 'MULTI-TEST-123';
    await page.getByRole('textbox', { name: 'External ID' }).fill(newExternalId);

    await page.getByRole('combobox').nth(5).click();
    await page.getByRole('option', { name: 'Europe/Berlin' }).click();

    await triggerAutosave(page);

    const templateDataFromDB = await getTemplateById({
      id: template.id,
      userId: user.id,
    });

    expect(templateDataFromDB.title).toBe(newTitle);
    expect(templateDataFromDB.templateMeta?.language).toBe('de');
    expect(templateDataFromDB.authOptions?.globalAccessAuth).toBe('ACCOUNT');
    expect(templateDataFromDB.externalId).toBe(newExternalId);
    expect(templateDataFromDB.templateMeta?.timezone).toBe('Europe/Berlin');
  });
});
