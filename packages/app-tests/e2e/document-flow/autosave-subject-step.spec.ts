import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { EnvelopeType } from '@prisma/client';

import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

export const setupDocumentAndNavigateToSubjectStep = async (page: Page) => {
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

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();

  return { user, team, document };
};

export const triggerAutosave = async (page: Page) => {
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await page.locator('#document-flow-form-container').blur();

  await page.waitForTimeout(5000);
};

test.describe('AutoSave Subject Step', () => {
  test('should autosave the subject field', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToSubjectStep(page);

    const subject = 'Hello world!';

    await page.getByRole('textbox', { name: 'Subject (Optional)' }).fill(subject);

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedDocumentData = await getEnvelopeById({
        id: {
          type: 'envelopeId',
          id: document.id,
        },
        type: EnvelopeType.DOCUMENT,
        userId: user.id,
        teamId: team.id,
      });

      await expect(page.getByRole('textbox', { name: 'Subject (Optional)' })).toHaveValue(
        retrievedDocumentData.documentMeta?.subject ?? '',
      );
    }).toPass();
  });

  test('should autosave the message field', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToSubjectStep(page);

    const message = 'Please review and sign this important document. Thank you!';

    await page.getByRole('textbox', { name: 'Message (Optional)' }).fill(message);

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedDocumentData = await getEnvelopeById({
        id: {
          type: 'envelopeId',
          id: document.id,
        },
        type: EnvelopeType.DOCUMENT,
        userId: user.id,
        teamId: team.id,
      });

      await expect(page.getByRole('textbox', { name: 'Message (Optional)' })).toHaveValue(
        retrievedDocumentData.documentMeta?.message ?? '',
      );
    }).toPass();
  });

  test('should autosave the email settings checkboxes', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToSubjectStep(page);

    // Toggle some email settings checkboxes (randomly - some checked, some unchecked)
    await page.getByText('Send recipient signed email').click();
    await page.getByText('Send recipient removed email').click();
    await page.getByText('Send document completed email', { exact: true }).click();
    await page.getByText('Send document deleted email').click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedDocumentData = await getEnvelopeById({
        id: {
          type: 'envelopeId',
          id: document.id,
        },
        type: EnvelopeType.DOCUMENT,
        userId: user.id,
        teamId: team.id,
      });

      const emailSettings = retrievedDocumentData.documentMeta?.emailSettings;

      await expect(page.getByText('Send recipient signed email')).toBeChecked({
        checked: emailSettings?.recipientSigned,
      });
      await expect(page.getByText('Send recipient removed email')).toBeChecked({
        checked: emailSettings?.recipientRemoved,
      });
      await expect(page.getByText('Send document completed email', { exact: true })).toBeChecked({
        checked: emailSettings?.documentCompleted,
      });
      await expect(page.getByText('Send document deleted email')).toBeChecked({
        checked: emailSettings?.documentDeleted,
      });

      await expect(page.getByText('Send recipient signing request email')).toBeChecked({
        checked: emailSettings?.recipientSigningRequest,
      });
      await expect(page.getByText('Send document pending email')).toBeChecked({
        checked: emailSettings?.documentPending,
      });
      await expect(page.getByText('Send document completed email to the owner')).toBeChecked({
        checked: emailSettings?.ownerDocumentCompleted,
      });
    }).toPass();
  });

  test('should autosave all fields and settings together', async ({ page }) => {
    const { user, document, team } = await setupDocumentAndNavigateToSubjectStep(page);

    const subject = 'Combined Test Subject - Please Sign';
    const message =
      'This is a comprehensive test message for autosave functionality. Please review and sign at your earliest convenience.';

    await page.getByRole('textbox', { name: 'Subject (Optional)' }).fill(subject);
    await page.getByRole('textbox', { name: 'Message (Optional)' }).fill(message);

    await page.getByText('Send recipient signed email').click();
    await page.getByText('Send recipient removed email').click();
    await page.getByText('Send document completed email', { exact: true }).click();
    await page.getByText('Send document deleted email').click();

    await triggerAutosave(page);

    await expect(async () => {
      const retrievedDocumentData = await getEnvelopeById({
        id: {
          type: 'envelopeId',
          id: document.id,
        },
        type: EnvelopeType.DOCUMENT,
        userId: user.id,
        teamId: team.id,
      });

      expect(retrievedDocumentData.documentMeta?.subject).toBe(subject);
      expect(retrievedDocumentData.documentMeta?.message).toBe(message);
      expect(retrievedDocumentData.documentMeta?.emailSettings).toBeDefined();

      await expect(page.getByRole('textbox', { name: 'Subject (Optional)' })).toHaveValue(
        retrievedDocumentData.documentMeta?.subject ?? '',
      );
      await expect(page.getByRole('textbox', { name: 'Message (Optional)' })).toHaveValue(
        retrievedDocumentData.documentMeta?.message ?? '',
      );

      await expect(page.getByText('Send recipient signed email')).toBeChecked({
        checked: retrievedDocumentData.documentMeta?.emailSettings?.recipientSigned,
      });
      await expect(page.getByText('Send recipient removed email')).toBeChecked({
        checked: retrievedDocumentData.documentMeta?.emailSettings?.recipientRemoved,
      });
      await expect(page.getByText('Send document completed email', { exact: true })).toBeChecked({
        checked: retrievedDocumentData.documentMeta?.emailSettings?.documentCompleted,
      });
      await expect(page.getByText('Send document deleted email')).toBeChecked({
        checked: retrievedDocumentData.documentMeta?.emailSettings?.documentDeleted,
      });

      await expect(page.getByText('Send recipient signing request email')).toBeChecked({
        checked: retrievedDocumentData.documentMeta?.emailSettings?.recipientSigningRequest,
      });
      await expect(page.getByText('Send document pending email')).toBeChecked({
        checked: retrievedDocumentData.documentMeta?.emailSettings?.documentPending,
      });
      await expect(page.getByText('Send document completed email to the owner')).toBeChecked({
        checked: retrievedDocumentData.documentMeta?.emailSettings?.ownerDocumentCompleted,
      });
    }).toPass();
  });
});
