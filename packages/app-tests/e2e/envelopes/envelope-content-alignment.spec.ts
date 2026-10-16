import fs from 'node:fs';
import path from 'node:path';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { getEnvelopeItemPdfUrl } from '@documenso/lib/utils/envelope-download';
import { prisma } from '@documenso/prisma';
import { seedContentAlignmentTestDocument } from '@documenso/prisma/seed/initial-seed';
import { seedUser } from '@documenso/prisma/seed/users';
import { createCanvas } from '@napi-rs/canvas';
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentStatus } from '@prisma/client';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pixelMatch from 'pixelmatch';
import { PNG } from 'pngjs';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../../lib/constants/app';
import type { TDistributeEnvelopeRequest } from '../../../trpc/server/envelope-router/distribute-envelope.types';
import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2`;

const VISUAL_REGRESSION_DIR = path.join(__dirname, '../../visual-regression');
const ITEM_TITLE = 'content-alignment-pdf';

test.describe.configure({ mode: 'parallel', timeout: 90000 });

/**
 * Seed the content alignment document, then run it through distribution and
 * signing so the contents are imprinted by the real seal job.
 *
 * Returns the sealed PDF bytes.
 */
const sealContentAlignmentDocument = async ({ page, request }: { page: Page; request: APIRequestContext }) => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test',
    expiresIn: null,
  });

  const envelope = await seedContentAlignmentTestDocument({
    userId: user.id,
    teamId: team.id,
    recipientName: user.name || '',
    recipientEmail: user.email,
    status: DocumentStatus.DRAFT,
  });

  const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { envelopeId: envelope.id } satisfies TDistributeEnvelopeRequest,
  });

  expect(distributeEnvelopeRequest.ok()).toBeTruthy();

  // Pre-insert the signature field so completing does not depend on the
  // signing UI. This test is about the contents, not the fields.
  const signatureField = await prisma.field.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  await prisma.field.update({
    where: { id: signatureField.id },
    data: {
      inserted: true,
      customText: '',
      signature: {
        create: {
          recipientId: envelope.recipients[0].id,
          typedSignature: 'Content Alignment',
        },
      },
    },
  });

  // Sign as the recipient so the seal job runs.
  const recipientToken = envelope.recipients[0].token;
  const signUrl = `/sign/${recipientToken}`;

  await apiSignin({ page, email: user.email, redirectPath: signUrl });

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);

  await expect(async () => {
    const { status } = await prisma.envelope.findFirstOrThrow({ where: { id: envelope.id } });

    expect(status).toBe(DocumentStatus.COMPLETED);
  }).toPass({ timeout: 20000 });

  const completed = await prisma.envelope.findFirstOrThrow({
    where: { id: envelope.id },
    include: { envelopeItems: { include: { documentData: true } } },
  });

  const documentUrl = getEnvelopeItemPdfUrl({
    type: 'download',
    envelopeItem: completed.envelopeItems[0],
    token: recipientToken,
    version: 'signed',
  });

  const pdfData = await fetch(documentUrl).then(async (res) => await res.arrayBuffer());

  return new Uint8Array(pdfData);
};

test('content placement visual regression', async ({ page, request }, testInfo) => {
  const pdfData = await sealContentAlignmentDocument({ page, request });

  const storedImages = fs
    .readdirSync(VISUAL_REGRESSION_DIR)
    .filter((image) => image.startsWith(`${ITEM_TITLE}-`))
    .sort()
    .map((image) => fs.readFileSync(path.join(VISUAL_REGRESSION_DIR, image)));

  expect(storedImages.length, 'Reference images missing, run the "download" test to generate them').toBeGreaterThan(0);

  await compareSealedPdfWithImages({ id: ITEM_TITLE, pdfData, images: storedImages, testInfo });
});

/**
 * Used to regenerate the reference images when the rendering legitimately
 * changes. Inspect the output carefully before committing.
 *
 * DON'T COMMIT THIS WITHOUT THE "SKIP" COMMAND.
 */
test.skip('download content alignment images', async ({ page, request }) => {
  const pdfData = await sealContentAlignmentDocument({ page, request });

  const pdfImages = await renderPdfToImage(pdfData);

  // The last page is the dynamic certificate, which is not compared.
  for (const [index, { image }] of pdfImages.slice(0, -1).entries()) {
    fs.writeFileSync(path.join(VISUAL_REGRESSION_DIR, `${ITEM_TITLE}-${index}.png`), new Uint8Array(image));
  }
});

async function renderPdfToImage(pdfBytes: Uint8Array) {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;

  // Increase for higher resolution
  const scale = 4;

  return await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, index) => {
      const page = await pdf.getPage(index + 1);
      const viewport = page.getViewport({ scale });

      const canvas = createCanvas(viewport.width, viewport.height);
      const canvasContext = canvas.getContext('2d');

      canvasContext.imageSmoothingEnabled = false;

      await page.render({
        // @ts-expect-error @napi-rs/canvas satisfies runtime requirements for pdfjs
        canvas,
        // @ts-expect-error @napi-rs/canvas satisfies runtime requirements for pdfjs
        canvasContext,
        viewport,
      }).promise;

      return {
        image: await canvas.encode('png'),
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
      };
    }),
  );
}

type CompareSealedPdfWithImagesOptions = {
  id: string;
  pdfData: Uint8Array;
  images: Buffer[];
  testInfo: TestInfo;
};

/**
 * Whether a rendered page has any non white pixels.
 */
const hasInk = (rgba: Uint8Array) => {
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index] < 250 || rgba[index + 1] < 250 || rgba[index + 2] < 250) {
      return true;
    }
  }

  return false;
};

const compareSealedPdfWithImages = async ({ id, pdfData, images, testInfo }: CompareSealedPdfWithImagesOptions) => {
  const renderedImages = await renderPdfToImage(pdfData);

  // Every content page must have a reference.
  expect(images).toHaveLength(renderedImages.length - 1);

  for (const [index, { image, width, height }] of renderedImages.entries()) {
    const isCertificate = index === renderedImages.length - 1;

    const newImage = new Uint8Array(PNG.sync.read(image).data);

    fs.writeFileSync(path.join(testInfo.outputPath(), `${id}-${index}-new.png`), new Uint8Array(image));

    if (isCertificate) {
      // The certificate is dynamic (dates, ids), so only assert it rendered.
      expect(hasInk(newImage)).toBe(true);
      continue;
    }

    const diff = new PNG({ width, height });
    const oldImage = new Uint8Array(PNG.sync.read(images[index]).data);

    const comparison = pixelMatch(
      oldImage,
      newImage,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      diff.data as unknown as Uint8Array,
      width,
      height,
      { threshold: 0.25 },
    );

    console.log(`${id}-${index}: ${comparison}`);

    fs.writeFileSync(path.join(testInfo.outputPath(), `${id}-${index}-diff.png`), new Uint8Array(PNG.sync.write(diff)));
    fs.writeFileSync(path.join(testInfo.outputPath(), `${id}-${index}-old.png`), new Uint8Array(images[index]));

    expect(comparison).toBe(0);
  }
};
