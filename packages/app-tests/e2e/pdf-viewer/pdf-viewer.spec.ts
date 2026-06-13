import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/create-embedding-presign-token';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prefixedId } from '@documenso/lib/universal/id';
import { mapSecondaryIdToDocumentId, mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { prisma } from '@documenso/prisma';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedPendingDocumentWithFullFields,
} from '@documenso/prisma/seed/documents';
import { seedBlankTemplate, seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Locator, test } from '@playwright/test';
import { FieldType } from '@prisma/client';
import { apiSeedPendingDocument } from '../fixtures/api-seeds';
import { apiSignin } from '../fixtures/authentication';

export const PDF_PAGE_SELECTOR = 'img[data-page-number]';

async function addSecondEnvelopeItem(envelopeId: string) {
  const firstItem = await prisma.envelopeItem.findFirstOrThrow({
    where: { envelopeId },
    orderBy: { order: 'asc' },
    include: { documentData: true },
  });

  const newDocumentData = await prisma.documentData.create({
    data: {
      type: firstItem.documentData.type,
      data: firstItem.documentData.data,
      initialData: firstItem.documentData.initialData,
    },
  });

  await prisma.envelopeItem.create({
    data: {
      id: prefixedId('envelope_item'),
      title: `${firstItem.title} - Page 2`,
      documentDataId: newDocumentData.id,
      order: 2,
      envelopeId,
    },
  });
}

async function getLocatorWidth(locator: Locator) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error('Locator bounding box not found');
  }

  return box.width;
}

test.describe('PDF Viewer Rendering', () => {
  test.describe('Authenticated Pages', () => {
    test('should render PDF on all authenticated pages (V1 and V2)', async ({ page }) => {
      const { user, team } = await seedUser();

      const documentV1 = await seedBlankDocument(user, team.id);
      const documentV2 = await seedBlankDocument(user, team.id, { internalVersion: 2 });
      await addSecondEnvelopeItem(documentV2.id);

      const templateV1 = await seedBlankTemplate(user, team.id);
      const templateV2 = await seedBlankTemplate(user, team.id, {
        createTemplateOptions: { internalVersion: 2 },
      });
      await addSecondEnvelopeItem(templateV2.id);

      await apiSignin({
        page,
        email: user.email,
        redirectPath: `/t/${team.url}/documents/${documentV1.id}`,
      });

      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/t/${team.url}/documents/${documentV2.id}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: /Page 2/ }).click();
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/t/${team.url}/templates/${templateV1.id}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/t/${team.url}/templates/${templateV2.id}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: /Page 2/ }).click();
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/t/${team.url}/documents/${documentV1.id}/edit`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/t/${team.url}/documents/${documentV2.id}/edit?step=addFields`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: /Page 2/ }).click();
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/t/${team.url}/templates/${templateV1.id}/edit`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/t/${team.url}/templates/${templateV2.id}/edit?step=addFields`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: /Page 2/ }).click();
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/t/${team.url}/documents/${documentV1.id}`);
      await page.locator(PDF_PAGE_SELECTOR).first().waitFor({ state: 'visible', timeout: 30_000 });
    });

    test('should zoom in and reset to fit width', async ({ page }) => {
      const { user, team } = await seedUser();
      const document = await seedBlankDocument(user, team.id, { internalVersion: 2 });

      await apiSignin({
        page,
        email: user.email,
        redirectPath: `/t/${team.url}/documents/${document.id}`,
      });

      const pageImage = page.locator(PDF_PAGE_SELECTOR).first();
      const pdfContent = page.locator('[data-pdf-content]');

      await expect(pageImage).toBeVisible({ timeout: 30_000 });

      const initialImageWidth = await getLocatorWidth(pageImage);
      const initialContentWidth = await getLocatorWidth(pdfContent);

      expect(Math.abs(initialImageWidth - initialContentWidth)).toBeLessThanOrEqual(2);

      await page.getByRole('button', { name: 'Zoom in' }).click();

      await expect.poll(async () => await getLocatorWidth(pageImage)).toBeGreaterThan(initialImageWidth);
      await expect.poll(async () => await getLocatorWidth(pdfContent)).toBeGreaterThan(initialContentWidth);

      await page.getByRole('button', { name: 'Reset zoom' }).click();

      await expect
        .poll(async () => Math.abs((await getLocatorWidth(pageImage)) - initialImageWidth))
        .toBeLessThanOrEqual(2);
    });
  });

  test.describe('Recipient Signing', () => {
    test('should render PDF on signing page (V1 and V2)', async ({ page }) => {
      const { user, team } = await seedUser();

      const { recipients: recipientsV1 } = await seedPendingDocumentWithFullFields({
        owner: user,
        teamId: team.id,
        recipients: ['signer-v1@test.documenso.com'],
        fields: [FieldType.SIGNATURE],
      });

      const { document: documentV2, recipients: recipientsV2 } = await seedPendingDocumentWithFullFields({
        owner: user,
        teamId: team.id,
        recipients: ['signer-v2@test.documenso.com'],
        fields: [FieldType.SIGNATURE],
        updateDocumentOptions: { internalVersion: 2 },
      });
      await addSecondEnvelopeItem(documentV2.id);

      await page.goto(`/sign/${recipientsV1[0].token}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/sign/${recipientsV2[0].token}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: /Page 2/ }).click();
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
    });

    test('should keep V2 signing fields clickable after zooming', async ({ page, request }) => {
      const { distributeResult, envelope } = await apiSeedPendingDocument(request, {
        recipients: [{ email: 'pdf-zoom-signer@test.documenso.com', name: 'PDF Zoom Signer' }],
        fieldsPerRecipient: [
          [
            {
              type: FieldType.SIGNATURE,
              page: 1,
              positionX: 10,
              positionY: 10,
              width: 15,
              height: 5,
            },
          ],
        ],
      });

      const { token } = distributeResult.recipients[0];

      await page.goto(`/sign/${token}`);

      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      const canvas = page.locator('.konva-container canvas').first();
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('1 Field Remaining').first()).toBeVisible();

      const initialCanvasWidth = await getLocatorWidth(canvas);

      await page.getByRole('button', { name: 'Zoom in' }).click();

      await expect.poll(async () => await getLocatorWidth(canvas)).toBeGreaterThan(initialCanvasWidth);

      await page.getByTestId('signature-pad-dialog-button').click();
      await page.getByRole('tab', { name: 'Type' }).click();
      await page.getByTestId('signature-pad-type-input').fill('Signature');
      await page.getByRole('button', { name: 'Next' }).click();

      const signatureField = envelope.fields.find((field) => field.type === FieldType.SIGNATURE);

      if (!signatureField) {
        throw new Error('Signature field not found');
      }

      const canvasBox = await canvas.boundingBox();

      if (!canvasBox) {
        throw new Error('Canvas bounding box not found');
      }

      const x =
        (Number(signatureField.positionX) / 100) * canvasBox.width +
        ((Number(signatureField.width) / 100) * canvasBox.width) / 2;
      const y =
        (Number(signatureField.positionY) / 100) * canvasBox.height +
        ((Number(signatureField.height) / 100) * canvasBox.height) / 2;

      await canvas.click({ position: { x, y } });

      await expect(page.getByText('0 Fields Remaining').first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Direct Template', () => {
    test('should render PDF on direct template page (V1 and V2)', async ({ page }) => {
      const { user, team } = await seedUser();

      const templateV1 = await seedDirectTemplate({
        title: 'PDF Viewer Test Template V1',
        userId: user.id,
        teamId: team.id,
      });

      const templateV2 = await seedDirectTemplate({
        title: 'PDF Viewer Test Template V2',
        userId: user.id,
        teamId: team.id,
        internalVersion: 2,
      });
      await addSecondEnvelopeItem(templateV2.id);

      await page.goto(formatDirectTemplatePath(templateV1.directLink?.token || ''));
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(formatDirectTemplatePath(templateV2.directLink?.token || ''));
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: /Page 2/ }).click();
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
    });
  });

  test.describe('Share Page', () => {
    test('should render PDF on share page (V1 and V2)', async ({ page }) => {
      const { user, team } = await seedUser();

      const qrTokenV1 = prefixedId('qr');
      const qrTokenV2 = prefixedId('qr');

      await seedCompletedDocument(user, team.id, ['share-v1@test.documenso.com'], {
        createDocumentOptions: { qrToken: qrTokenV1 },
      });

      const documentV2 = await seedCompletedDocument(user, team.id, ['share-v2@test.documenso.com'], {
        createDocumentOptions: { qrToken: qrTokenV2 },
        internalVersion: 2,
      });
      await addSecondEnvelopeItem(documentV2.id);

      await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${qrTokenV1}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${qrTokenV2}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.getByRole('button', { name: /Page 2/ }).click();
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
    });

    test('should not return 500 for invalid QR share token', async ({ page }) => {
      const response = await page.request.get('/share/qr_invalid_token_for_regression_check', {
        maxRedirects: 0,
      });

      expect(response.status()).toBe(302);
      expect(response.headers().location).toBe('/');
    });
  });

  test.describe('Embed Pages', () => {
    test('should render PDF on embed sign page (V1 and V2)', async ({ page }) => {
      const { user, team } = await seedUser();

      const { recipients: recipientsV1 } = await seedPendingDocumentWithFullFields({
        owner: user,
        teamId: team.id,
        recipients: ['embed-signer-v1@test.documenso.com'],
        fields: [FieldType.SIGNATURE],
      });

      const { document: documentV2, recipients: recipientsV2 } = await seedPendingDocumentWithFullFields({
        owner: user,
        teamId: team.id,
        recipients: ['embed-signer-v2@test.documenso.com'],
        fields: [FieldType.SIGNATURE],
        updateDocumentOptions: { internalVersion: 2 },
      });
      await addSecondEnvelopeItem(documentV2.id);

      await page.goto(`/embed/sign/${recipientsV1[0].token}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/embed/sign/${recipientsV2[0].token}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      // Todo: Multisign does not support multiple envelope items.
      // await page.getByRole('button', { name: /Page 2/ }).click();
      // await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
    });

    test('should render PDF on embed direct template page (V1 and V2)', async ({ page }) => {
      const { user, team } = await seedUser();

      const templateV1 = await seedDirectTemplate({
        title: 'Embed Direct Template V1',
        userId: user.id,
        teamId: team.id,
      });

      const templateV2 = await seedDirectTemplate({
        title: 'Embed Direct Template V2',
        userId: user.id,
        teamId: team.id,
        internalVersion: 2,
      });
      await addSecondEnvelopeItem(templateV2.id);

      await page.goto(`/embed/direct/${templateV1.directLink?.token || ''}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/embed/direct/${templateV2.directLink?.token || ''}`);
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: /Page 2/ }).click();
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
    });

    test('should render PDF on embed multisign page (V1 and V2)', async ({ page }) => {
      const { user, team } = await seedUser();

      const { recipients: recipientsV1 } = await seedPendingDocumentWithFullFields({
        owner: user,
        teamId: team.id,
        recipients: ['multisign-v1@test.documenso.com'],
        fields: [FieldType.SIGNATURE],
      });

      const { document: documentV2, recipients: recipientsV2 } = await seedPendingDocumentWithFullFields({
        owner: user,
        teamId: team.id,
        recipients: ['multisign-v2@test.documenso.com'],
        fields: [FieldType.SIGNATURE],
        updateDocumentOptions: { internalVersion: 2 },
      });
      await addSecondEnvelopeItem(documentV2.id);

      await page.goto(`/embed/v1/multisign?token=${recipientsV1[0].token}`);
      await expect(page.getByText('Sign Documents')).toBeVisible({ timeout: 15_000 });

      // Todo: Multisign does not support multiple envelope items.
      // await page.getByRole('button', { name: /View/i }).first().click();
      // await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/embed/v1/multisign?token=${recipientsV2[0].token}`);
      await expect(page.getByText('Sign Documents')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /View/i }).first().click();
      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

      // Todo: Multisign does not support multiple envelope items.
      // await page.getByRole('button', { name: /Page 2/ }).click();
      // await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
    });

    test('should render PDF on embed authoring document create page', async ({ page }) => {
      const { user, team } = await seedUser();

      const { token: apiToken } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'pdf-viewer-test',
        expiresIn: null,
      });

      const { token: presignToken } = await createEmbeddingPresignToken({
        apiToken,
      });

      const embedParams = { darkModeDisabled: false, features: {} };
      const hash = btoa(encodeURIComponent(JSON.stringify(embedParams)));

      await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/embed/v1/authoring/document/create?token=${presignToken}#${hash}`);

      await expect(page.getByText('Configure Document')).toBeVisible({ timeout: 15_000 });

      const titleInput = page.getByLabel('Title');
      await titleInput.click();
      await titleInput.fill('PDF Viewer E2E Test');

      const emailInput = page.getByPlaceholder('Email').first();
      await emailInput.click();
      await emailInput.fill('test-signer@documenso.com');

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page
          .locator('input[type=file]')
          .first()
          .evaluate((el) => {
            if (el instanceof HTMLInputElement) {
              el.click();
            }
          }),
      ]);

      await fileChooser.setFiles(path.join(__dirname, '../../../../assets/example.pdf'));

      await page.getByRole('button', { name: 'Continue' }).click();

      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
    });

    test('should render PDF on embed document edit page', async ({ page }) => {
      const { user, team } = await seedUser();

      const document = await seedBlankDocument(user, team.id);
      const documentId = mapSecondaryIdToDocumentId(document.secondaryId);

      const { token: apiToken } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'pdf-viewer-doc-edit-test',
        expiresIn: null,
      });

      const { token: presignToken } = await createEmbeddingPresignToken({
        apiToken,
        scope: `documentId:${documentId}`,
      });

      const embedParams = {
        darkModeDisabled: false,
        features: {},
        onlyEditFields: true,
      };
      const hash = btoa(encodeURIComponent(JSON.stringify(embedParams)));

      await page.goto(
        `${NEXT_PUBLIC_WEBAPP_URL()}/embed/v1/authoring/document/edit/${documentId}?token=${presignToken}#${hash}`,
      );

      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
    });

    test('should render PDF on embed template edit page', async ({ page }) => {
      const { user, team } = await seedUser();

      const template = await seedBlankTemplate(user, team.id);
      const templateId = mapSecondaryIdToTemplateId(template.secondaryId);

      const { token: apiToken } = await createApiToken({
        userId: user.id,
        teamId: team.id,
        tokenName: 'pdf-viewer-template-edit-test',
        expiresIn: null,
      });

      const { token: presignToken } = await createEmbeddingPresignToken({
        apiToken,
        scope: `templateId:${templateId}`,
      });

      const embedParams = {
        darkModeDisabled: false,
        features: {},
        onlyEditFields: true,
      };
      const hash = btoa(encodeURIComponent(JSON.stringify(embedParams)));

      await page.goto(
        `${NEXT_PUBLIC_WEBAPP_URL()}/embed/v1/authoring/template/edit/${templateId}?token=${presignToken}#${hash}`,
      );

      await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
    });
  });
});
