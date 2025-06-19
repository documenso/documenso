import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';

import { getDocumentByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

test.describe('Signing Certificate Tests', () => {
  test('individual document should always include signing certificate', async ({ page }) => {
    const { user, team } = await seedUser({
      isPersonalOrganisation: true,
    });

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: user,
      recipients: ['signer@example.com'],
      fields: [FieldType.SIGNATURE],
      teamId: team.id,
    });

    const documentData = await prisma.documentData
      .findFirstOrThrow({
        where: {
          id: document.documentDataId,
        },
      })
      .then(async (data) => getFile(data));

    const originalPdf = await PDFDocument.load(documentData);

    const recipient = recipients[0];

    // Sign the document
    await page.goto(`/sign/${recipient.token}`);

    await signSignaturePad(page);

    for (const field of recipient.fields) {
      await page.locator(`#field-${field.id}`).getByRole('button').click();

      await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
    }

    await page.getByRole('button', { name: 'Complete' }).click();
    await page.getByRole('button', { name: 'Sign' }).click({ force: true });
    await page.waitForURL(`/sign/${recipient.token}/complete`);

    await page.waitForTimeout(10000);

    await expect(async () => {
      const { status } = await getDocumentByToken({
        token: recipient.token,
      });

      expect(status).toBe(DocumentStatus.COMPLETED);
    }).toPass();

    await page.waitForTimeout(2500);

    // Get the completed document
    const completedDocument = await prisma.document.findFirstOrThrow({
      where: { id: document.id },
      include: { documentData: true },
    });

    const completedDocumentData = await getFile(completedDocument.documentData);

    // Load the PDF and check number of pages
    const pdfDoc = await PDFDocument.load(completedDocumentData);

    expect(pdfDoc.getPageCount()).toBe(originalPdf.getPageCount() + 1); // Original + Certificate
  });

  test('team document with signing certificate enabled should include certificate', async ({
    page,
  }) => {
    const { owner, team } = await seedTeam();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: owner,
      recipients: ['signer@example.com'],
      fields: [FieldType.SIGNATURE],
      teamId: team.id,
    });

    const teamSettingsId = await prisma.teamGlobalSettings.findFirstOrThrow({
      where: {
        team: {
          id: team.id,
        },
      },
    });

    await prisma.teamGlobalSettings.update({
      where: {
        id: teamSettingsId.id,
      },
      data: {
        includeSigningCertificate: true,
      },
    });

    const documentData = await prisma.documentData
      .findFirstOrThrow({
        where: {
          id: document.documentDataId,
        },
      })
      .then(async (data) => getFile(data));

    const originalPdf = await PDFDocument.load(documentData);

    const recipient = recipients[0];

    // Sign the document
    await page.goto(`/sign/${recipient.token}`);

    await signSignaturePad(page);

    for (const field of recipient.fields) {
      await page.locator(`#field-${field.id}`).getByRole('button').click();

      await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
    }

    await page.getByRole('button', { name: 'Complete' }).click();
    await page.getByRole('button', { name: 'Sign' }).click();
    await page.waitForURL(`/sign/${recipient.token}/complete`);

    await expect(async () => {
      const { status } = await getDocumentByToken({
        token: recipient.token,
      });

      expect(status).toBe(DocumentStatus.COMPLETED);
    }).toPass();

    await page.waitForTimeout(2500);

    // Get the completed document
    const completedDocument = await prisma.document.findFirstOrThrow({
      where: { id: document.id },
      include: { documentData: true },
    });

    const completedDocumentData = await getFile(completedDocument.documentData);

    // Load the PDF and check number of pages
    const completedPdf = await PDFDocument.load(completedDocumentData);

    expect(completedPdf.getPageCount()).toBe(originalPdf.getPageCount() + 1); // Original + Certificate
  });

  test('team document with signing certificate disabled should not include certificate', async ({
    page,
  }) => {
    const { owner, team } = await seedTeam();

    const { document, recipients } = await seedPendingDocumentWithFullFields({
      owner: owner,
      recipients: ['signer@example.com'],
      fields: [FieldType.SIGNATURE],
      teamId: team.id,
    });

    const teamSettingsId = await prisma.teamGlobalSettings.findFirstOrThrow({
      where: {
        team: {
          id: team.id,
        },
      },
    });

    await prisma.teamGlobalSettings.update({
      where: {
        id: teamSettingsId.id,
      },
      data: {
        includeSigningCertificate: false,
      },
    });

    const documentData = await prisma.documentData
      .findFirstOrThrow({
        where: {
          id: document.documentDataId,
        },
      })
      .then(async (data) => getFile(data));

    const originalPdf = await PDFDocument.load(documentData);

    const recipient = recipients[0];

    // Sign the document
    await page.goto(`/sign/${recipient.token}`);

    await signSignaturePad(page);

    for (const field of recipient.fields) {
      await page.locator(`#field-${field.id}`).getByRole('button').click();

      await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
    }

    await page.getByRole('button', { name: 'Complete' }).click();
    await page.getByRole('button', { name: 'Sign' }).click();
    await page.waitForURL(`/sign/${recipient.token}/complete`);

    await expect(async () => {
      const { status } = await getDocumentByToken({
        token: recipient.token,
      });

      expect(status).toBe(DocumentStatus.COMPLETED);
    }).toPass();

    await page.waitForTimeout(2500);

    // Get the completed document
    const completedDocument = await prisma.document.findFirstOrThrow({
      where: { id: document.id },
      include: { documentData: true },
    });

    const completedDocumentData = await getFile(completedDocument.documentData);

    // Load the PDF and check number of pages
    const completedPdf = await PDFDocument.load(completedDocumentData);

    expect(completedPdf.getPageCount()).toBe(originalPdf.getPageCount());
  });

  test('team can toggle signing certificate setting', async ({ page }) => {
    const { owner, team } = await seedTeam();

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/settings/preferences`,
    });

    await page
      .getByRole('group')
      .locator('div')
      .filter({ hasText: 'Include the Signing' })
      .getByRole('combobox')
      .click();
    await page.getByRole('option', { name: 'No' }).click();

    await page
      .getByRole('button', { name: /Update/ })
      .first()
      .click();

    await page.waitForTimeout(1000);

    // Verify the setting was saved
    const updatedTeam = await prisma.team.findFirstOrThrow({
      where: { id: team.id },
      include: { teamGlobalSettings: true },
    });

    expect(updatedTeam.teamGlobalSettings?.includeSigningCertificate).toBe(false);

    // Toggle the setting back to true
    await page
      .getByRole('group')
      .locator('div')
      .filter({ hasText: 'Include the Signing' })
      .getByRole('combobox')
      .click();
    await page.getByRole('option', { name: 'Yes' }).click();
    await page
      .getByRole('button', { name: /Update/ })
      .first()
      .click();

    await page.waitForTimeout(1000);

    // Verify the setting was saved
    const updatedTeam2 = await prisma.team.findFirstOrThrow({
      where: { id: team.id },
      include: { teamGlobalSettings: true },
    });

    expect(updatedTeam2.teamGlobalSettings?.includeSigningCertificate).toBe(true);
  });
});
