import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const setupTemplate = async (page: Page) => {
  const { user, team } = await seedUser();
  const template = await seedBlankTemplate(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${mapSecondaryIdToTemplateId(template.secondaryId)}/edit`,
  });

  return { user, team, template };
};

const triggerAutosave = async (page: Page) => {
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await page.locator('#document-flow-form-container').blur();

  await page.waitForTimeout(5000);
};

test.describe('AutoSave Settings Step - Templates', () => {
  test('should autosave the title change', async ({ page }) => {
    const { user, template, team } = await setupTemplate(page);

    const newTemplateTitle = 'New Template Title';

    await page.getByRole('textbox', { name: 'Title *' }).fill(newTemplateTitle);

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: template.id,
        },
        userId: user.id,
        teamId: team.id,
      });

      await expect(page.getByRole('textbox', { name: 'Title *' })).toHaveValue(
        retrievedTemplate.title,
      );
    }).toPass();
  });

  test('should autosave the language change', async ({ page }) => {
    const { user, template, team } = await setupTemplate(page);

    const newTemplateLanguage = 'French';
    const expectedLanguageCode = 'fr';

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: newTemplateLanguage }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: template.id,
        },
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedTemplate.templateMeta?.language).toBe(expectedLanguageCode);
    }).toPass();
  });

  test('should autosave the template access change', async ({ page }) => {
    const { user, template, team } = await setupTemplate(page);

    const access = 'Require account';
    const accessValue = 'ACCOUNT';

    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: access }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: template.id,
        },
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedTemplate.authOptions?.globalAccessAuth).toContain(accessValue);
    }).toPass();
  });

  test('should autosave the external ID change', async ({ page }) => {
    const { user, template, team } = await setupTemplate(page);

    const newExternalId = '1234567890';

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('textbox', { name: 'External ID' }).fill(newExternalId);

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: template.id,
        },
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedTemplate.externalId).toBe(newExternalId);
    }).toPass();
  });

  test('should autosave the allowed signature types change', async ({ page }) => {
    const { user, template, team } = await setupTemplate(page);

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('combobox').nth(4).click();
    await page.getByRole('option', { name: 'Draw' }).click();
    await page.getByRole('option', { name: 'Type' }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: template.id,
        },
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedTemplate.templateMeta?.drawSignatureEnabled).toBe(false);
      expect(retrievedTemplate.templateMeta?.typedSignatureEnabled).toBe(false);
      expect(retrievedTemplate.templateMeta?.uploadSignatureEnabled).toBe(true);
    }).toPass();
  });

  test('should autosave the date format change', async ({ page }) => {
    const { user, template, team } = await setupTemplate(page);

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('combobox').nth(5).click();
    await page.getByRole('option', { name: 'ISO 8601', exact: true }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: template.id,
        },
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedTemplate.templateMeta?.dateFormat).toBe("yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
    }).toPass();
  });

  test('should autosave the timezone change', async ({ page }) => {
    const { user, template, team } = await setupTemplate(page);

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('combobox').nth(6).click();
    await page.getByRole('option', { name: 'Europe/London' }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: template.id,
        },
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedTemplate.templateMeta?.timezone).toBe('Europe/London');
    }).toPass();
  });

  test('should autosave the redirect URL change', async ({ page }) => {
    const { user, template, team } = await setupTemplate(page);

    const newRedirectUrl = 'https://documenso.com/test/';

    await page.getByRole('button', { name: 'Advanced Options' }).click();

    await page.getByRole('textbox', { name: 'Redirect URL' }).fill(newRedirectUrl);

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: template.id,
        },
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedTemplate.templateMeta?.redirectUrl).toBe(newRedirectUrl);
    }).toPass();
  });

  test('should autosave multiple field changes together', async ({ page }) => {
    const { user, template, team } = await setupTemplate(page);

    const newTitle = 'Updated Template Title';
    await page.getByRole('textbox', { name: 'Title *' }).fill(newTitle);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'German' }).click();

    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Require account' }).click();

    await page.getByRole('button', { name: 'Advanced Options' }).click();
    const newExternalId = 'MULTI-TEST-123';
    await page.getByRole('textbox', { name: 'External ID' }).fill(newExternalId);

    await page.getByRole('combobox').nth(6).click();
    await page.getByRole('option', { name: 'Europe/Berlin' }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: template.id,
        },
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedTemplate.title).toBe(newTitle);
      expect(retrievedTemplate.templateMeta?.language).toBe('de');
      expect(retrievedTemplate.authOptions?.globalAccessAuth).toContain('ACCOUNT');
      expect(retrievedTemplate.externalId).toBe(newExternalId);
      expect(retrievedTemplate.templateMeta?.timezone).toBe('Europe/Berlin');
    }).toPass();
  });
});
