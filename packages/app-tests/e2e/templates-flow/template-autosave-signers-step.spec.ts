import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { EnvelopeType } from '@prisma/client';

import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const setupTemplateAndNavigateToSignersStep = async (page: Page) => {
  const { user, team } = await seedUser();
  const template = await seedBlankTemplate(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${mapSecondaryIdToTemplateId(template.secondaryId)}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  return { user, team, template };
};

const triggerAutosave = async (page: Page) => {
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await page.locator('#document-flow-form-container').blur();

  await page.waitForTimeout(5000);
};

const addSignerAndSave = async (page: Page) => {
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');

  await triggerAutosave(page);
};

test.describe('AutoSave Signers Step - Templates', () => {
  test('should autosave the signers addition', async ({ page }) => {
    const { user, template, team } = await setupTemplateAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await expect(async () => {
      const retrievedRecipients = await getRecipientsForTemplate({
        templateId: mapSecondaryIdToTemplateId(template.secondaryId),
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedRecipients.length).toBe(1);
      expect(retrievedRecipients[0].email).toBe('recipient1@documenso.com');
      expect(retrievedRecipients[0].name).toBe('Recipient 1');
    }).toPass();
  });

  test('should autosave the signer deletion', async ({ page }) => {
    const { user, template, team } = await setupTemplateAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await page.getByRole('button', { name: 'Add myself' }).click();
    await triggerAutosave(page);

    await page.getByTestId('remove-placeholder-recipient-button').first().click();
    await triggerAutosave(page);

    await expect(async () => {
      const retrievedRecipients = await getRecipientsForTemplate({
        templateId: mapSecondaryIdToTemplateId(template.secondaryId),
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedRecipients.length).toBe(1);
      expect(retrievedRecipients[0].email).toBe(user.email);
      expect(retrievedRecipients[0].name).toBe(user.name);
    }).toPass();
  });

  test('should autosave the signer update', async ({ page }) => {
    const { user, template, team } = await setupTemplateAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await page.getByPlaceholder('Name').fill('Documenso Manager');
    await page.getByPlaceholder('Email').fill('manager@documenso.com');

    await triggerAutosave(page);

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Receives copy' }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedRecipients = await getRecipientsForTemplate({
        templateId: mapSecondaryIdToTemplateId(template.secondaryId),
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedRecipients.length).toBe(1);
      expect(retrievedRecipients[0].email).toBe('manager@documenso.com');
      expect(retrievedRecipients[0].name).toBe('Documenso Manager');
      expect(retrievedRecipients[0].role).toBe('CC');
    }).toPass();
  });

  test('should autosave the signing order change', async ({ page }) => {
    const { user, template, team } = await setupTemplateAndNavigateToSignersStep(page);

    await addSignerAndSave(page);

    await page.getByRole('button', { name: 'Add placeholder recipient' }).click();

    await page
      .getByTestId('placeholder-recipient-email-input')
      .nth(1)
      .fill('recipient2@documenso.com');
    await page.getByTestId('placeholder-recipient-name-input').nth(1).fill('Recipient 2');

    await page.getByRole('button', { name: 'Add placeholder recipient' }).click();

    await page
      .getByTestId('placeholder-recipient-email-input')
      .nth(2)
      .fill('recipient3@documenso.com');
    await page.getByTestId('placeholder-recipient-name-input').nth(2).fill('Recipient 3');

    await triggerAutosave(page);

    await page.getByLabel('Enable signing order').check();
    await page.getByLabel('Allow signers to dictate next signer').check();
    await triggerAutosave(page);

    await page.getByTestId('placeholder-recipient-signing-order-input').nth(0).fill('3');
    await page.getByTestId('placeholder-recipient-signing-order-input').nth(0).blur();
    await triggerAutosave(page);

    await page.getByTestId('placeholder-recipient-signing-order-input').nth(1).fill('1');
    await page.getByTestId('placeholder-recipient-signing-order-input').nth(1).blur();
    await triggerAutosave(page);

    await page.getByTestId('placeholder-recipient-signing-order-input').nth(2).fill('2');
    await page.getByTestId('placeholder-recipient-signing-order-input').nth(2).blur();
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

      const retrievedRecipients = await getRecipientsForTemplate({
        templateId: mapSecondaryIdToTemplateId(template.secondaryId),
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedTemplate.templateMeta?.signingOrder).toBe('SEQUENTIAL');
      expect(retrievedTemplate.templateMeta?.allowDictateNextSigner).toBe(true);
      expect(retrievedRecipients.length).toBe(3);
      expect(retrievedRecipients[0].signingOrder).toBe(2);
      expect(retrievedRecipients[1].signingOrder).toBe(3);
      expect(retrievedRecipients[2].signingOrder).toBe(1);
    }).toPass();
  });
});

export interface GetRecipientsForTemplateOptions {
  templateId: number;
  userId: number;
  teamId: number;
}

const getRecipientsForTemplate = async ({
  templateId,
  userId,
  teamId,
}: GetRecipientsForTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'templateId',
      id: templateId,
    },
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const recipients = await prisma.recipient.findMany({
    where: {
      envelope: envelopeWhereInput,
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
