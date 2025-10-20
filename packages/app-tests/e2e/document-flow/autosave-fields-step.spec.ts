import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

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

  await page.getByRole('button', { name: 'Add signer' }).click();

  await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

  await page.getByRole('button', { name: 'Continue' }).click();

  return { user, team, document };
};

const triggerAutosave = async (page: Page) => {
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await page.locator('#document-flow-form-container').blur();

  await page.waitForTimeout(5000);
};

test.describe('AutoSave Fields Step', () => {
  test('should autosave the fields without advanced settings', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToFieldsStep(page);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 100,
      },
    });

    await page.getByRole('button', { name: 'Text' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 200,
      },
    });

    await page.getByTestId('field-advanced-settings-footer').waitFor({ state: 'visible' });

    await page
      .getByTestId('field-advanced-settings-footer')
      .getByRole('button', { name: 'Cancel' })
      .click();

    await triggerAutosave(page);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Recipient 2 (recipient2@documenso.com)' }).click();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 500,
      },
    });

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedFields = await getFieldsForEnvelope({
        envelopeId: document.id,
      });

      expect(retrievedFields.length).toBe(3);
      expect(retrievedFields[0].type).toBe('SIGNATURE');
      expect(retrievedFields[1].type).toBe('TEXT');
      expect(retrievedFields[2].type).toBe('SIGNATURE');
    }).toPass();
  });

  test('should autosave the field deletion', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToFieldsStep(page);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 100,
      },
    });

    await page.getByRole('button', { name: 'Text' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 200,
      },
    });

    await page.getByTestId('field-advanced-settings-footer').waitFor({ state: 'visible' });

    await page
      .getByTestId('field-advanced-settings-footer')
      .getByRole('button', { name: 'Cancel' })
      .click();

    await triggerAutosave(page);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Recipient 2 (recipient2@documenso.com)' }).click();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 500,
      },
    });

    await triggerAutosave(page);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Recipient 1 (recipient1@documenso.com)' }).click();

    await page.getByText('Text').nth(1).click();
    await page.getByRole('button', { name: 'Remove' }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedFields = await getFieldsForEnvelope({
        envelopeId: document.id,
      });

      expect(retrievedFields.length).toBe(2);
      expect(retrievedFields[0].type).toBe('SIGNATURE');
      expect(retrievedFields[1].type).toBe('SIGNATURE');
    }).toPass();
  });

  test('should autosave the field duplication', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToFieldsStep(page);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 100,
      },
    });

    await page.getByRole('button', { name: 'Text' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 200,
      },
    });

    await page.getByTestId('field-advanced-settings-footer').waitFor({ state: 'visible' });

    await page
      .getByTestId('field-advanced-settings-footer')
      .getByRole('button', { name: 'Cancel' })
      .click();

    await triggerAutosave(page);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Recipient 2 (recipient2@documenso.com)' }).click();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 500,
      },
    });

    await triggerAutosave(page);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Recipient 1 (recipient1@documenso.com)' }).click();

    await page.getByText('Signature').nth(1).click();
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedFields = await getFieldsForEnvelope({
        envelopeId: document.id,
      });

      expect(retrievedFields.length).toBe(4);
      expect(retrievedFields[0].type).toBe('SIGNATURE');
      expect(retrievedFields[1].type).toBe('TEXT');
      expect(retrievedFields[2].type).toBe('SIGNATURE');
      expect(retrievedFields[3].type).toBe('SIGNATURE');
    }).toPass();
  });

  test('should autosave the fields with advanced settings', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToFieldsStep(page);

    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Signature' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 100,
      },
    });

    await page.getByRole('button', { name: 'Text' }).click();
    await page.locator('canvas').click({
      position: {
        x: 100,
        y: 200,
      },
    });

    await page.getByRole('textbox', { name: 'Field label' }).fill('Test Field');
    await page.getByRole('textbox', { name: 'Field placeholder' }).fill('Test Placeholder');
    await page.getByRole('textbox', { name: 'Add text to the field' }).fill('Test Text');

    await page
      .getByTestId('field-advanced-settings-footer')
      .getByRole('button', { name: 'Save' })
      .click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedFields = await getFieldsForEnvelope({
        envelopeId: document.id,
      });

      expect(retrievedFields.length).toBe(2);
      expect(retrievedFields[0].type).toBe('SIGNATURE');
      expect(retrievedFields[1].type).toBe('TEXT');

      const textField = retrievedFields[1];
      expect(textField.fieldMeta).toBeDefined();

      if (
        textField.fieldMeta &&
        typeof textField.fieldMeta === 'object' &&
        'type' in textField.fieldMeta
      ) {
        expect(textField.fieldMeta.type).toBe('text');
        expect(textField.fieldMeta.label).toBe('Test Field');
        expect(textField.fieldMeta.placeholder).toBe('Test Placeholder');

        if (textField.fieldMeta.type === 'text') {
          expect(textField.fieldMeta.text).toBe('Test Text');
        }
      } else {
        throw new Error('fieldMeta should be defined and contain advanced settings');
      }
    }).toPass();
  });
});

const getFieldsForEnvelope = async ({ envelopeId }: { envelopeId: string }) => {
  const fields = await prisma.field.findMany({
    where: {
      envelope: {
        id: envelopeId,
      },
    },
    include: {
      signature: true,
      recipient: {
        select: {
          name: true,
          email: true,
          signingStatus: true,
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return fields;
};
