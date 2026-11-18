import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import {
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getEnvelopeItemDropzoneInput,
  getEnvelopeItemReplaceButtons,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  setRecipientEmail,
  setRecipientName,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';
import { getKonvaElementCountForPage } from '../fixtures/konva';

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

// Two text fields, a checkbox and a dropdown.
const formFieldsPdf = {
  name: 'form-fields-test.pdf',
  mimeType: 'application/pdf',
  buffer: fs.readFileSync(path.join(__dirname, '../../../../assets/form-fields-test.pdf')),
};

/**
 * Put the PDF with form fields on the envelope, add a recipient and open the fields step.
 */
const openFieldsStepWithFormPdf = async ({ root, isEmbedded }: TEnvelopeEditorSurface) => {
  if (isEmbedded) {
    await getEnvelopeItemDropzoneInput(root).setInputFiles(formFieldsPdf);
    await setRecipientEmail(root, 0, 'embedded-recipient@documenso.com');
    await setRecipientName(root, 0, 'Embedded Recipient');
  } else {
    const replaceButton = getEnvelopeItemReplaceButtons(root).nth(0);

    const [fileChooser] = await Promise.all([root.waitForEvent('filechooser'), replaceButton.click()]);

    await fileChooser.setFiles(formFieldsPdf);

    await expect(replaceButton).toBeDisabled({ timeout: 15000 });
    await expect(replaceButton).toBeEnabled({ timeout: 15000 });

    await clickAddMyselfButton(root);
  }

  await clickEnvelopeEditorStep(root, 'addFields');

  // The viewer reports the form fields before it renders the page.
  await expect(root.getByText('Selected Recipient')).toBeVisible();
  await expect(root.locator('.konva-container canvas').first()).toBeVisible();
};

const getImportButton = ({ root }: TEnvelopeEditorSurface) =>
  root.getByRole('button', { name: 'Import from PDF form' });

test.describe('document editor', () => {
  test('imports the PDF form fields for the selected recipient', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await openFieldsStepWithFormPdf(surface);

    await getImportButton(surface).click();

    await expectToastTextToBeVisible(page, '4 fields were imported from the PDF form.');
    await expect.poll(async () => await getKonvaElementCountForPage(page, 1, '.field-group')).toBe(4);

    // The form is gone from the PDF, so there is nothing more to import.
    await expect(getImportButton(surface)).toHaveCount(0);

    const fields = await prisma.field.findMany({
      where: { envelopeId: surface.envelopeId },
      include: { recipient: true },
    });

    expect(fields).toHaveLength(4);
    expect(fields.every((field) => field.recipient.email === surface.userEmail)).toBe(true);
  });
});

test.describe('template editor', () => {
  // A template keeps its PDF form, so that a document created from it can receive form values.
  test('does not offer the PDF form import', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    await openFieldsStepWithFormPdf(surface);

    await expect(getImportButton(surface)).toHaveCount(0);
  });
});

test.describe('embedded create', () => {
  test('does not offer the PDF form import', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-acroform',
    });

    await openFieldsStepWithFormPdf(surface);

    await expect(getImportButton(surface)).toHaveCount(0);
  });
});
