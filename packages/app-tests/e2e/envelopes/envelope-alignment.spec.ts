// sort-imports-ignore

// ---- PATCH pdfjs-dist's canvas require BEFORE importing it ----
import Module from 'module';
import { Canvas, Image } from 'skia-canvas';

// Intercept require('canvas') and return skia-canvas equivalents
const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string) {
  if (path === 'canvas') {
    return {
      createCanvas: (width: number, height: number) => new Canvas(width, height),
      Image, // needed by pdfjs-dist
    };
  }
  // eslint-disable-next-line prefer-rest-params, @typescript-eslint/consistent-type-assertions
  return originalRequire.apply(this, arguments as unknown as [string]);
};

import pixelMatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentStatus } from '@prisma/client';
import fs from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

import { getFile } from '@documenso/lib/universal/upload/get-file';
import { prisma } from '@documenso/prisma';
import { seedAlignmentTestDocument } from '@documenso/prisma/seed/initial-seed';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

test('field placement visual regression', async ({ page }, testInfo) => {
  const { user, team } = await seedUser();

  const envelope = await seedAlignmentTestDocument({
    userId: user.id,
    teamId: team.id,
    recipientName: user.name || '',
    recipientEmail: user.email,
    insertFields: true,
    status: DocumentStatus.PENDING,
  });

  const token = envelope.recipients[0].token;

  const signUrl = `/sign/${token}`;

  await apiSignin({
    page,
    email: user.email,
    redirectPath: signUrl,
  });

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);

  await expect(async () => {
    const { status } = await prisma.envelope.findFirstOrThrow({
      where: {
        id: envelope.id,
      },
    });

    expect(status).toBe(DocumentStatus.COMPLETED);
  }).toPass({
    timeout: 10000,
  });

  const completedDocument = await prisma.envelope.findFirstOrThrow({
    where: {
      id: envelope.id,
    },
    include: {
      envelopeItems: {
        orderBy: {
          order: 'asc',
        },
        include: {
          documentData: true,
        },
      },
    },
  });

  const storedImages = fs.readdirSync(`packages/app-tests/visual-regression`);

  await Promise.all(
    completedDocument.envelopeItems.map(async (item) => {
      const pdfData = await getFile(item.documentData);

      const loadedImages = storedImages
        .filter((image) => image.includes(item.title))
        .map((image) => fs.readFileSync(`packages/app-tests/visual-regression/${image}`));

      await compareSignedPdfWithImages({
        id: item.title.replaceAll(' ', '-').toLowerCase(),
        pdfData,
        images: loadedImages,
        testInfo,
      });
    }),
  );
});

/**
 * Used to download the envelope images when updating the visual regression test.
 *
 * DON'T COMMIT THIS WITHOUT THE "SKIP" COMMAND.
 */
test.skip('download envelope images', async ({ page }) => {
  const { user, team } = await seedUser();

  const envelope = await seedAlignmentTestDocument({
    userId: user.id,
    teamId: team.id,
    recipientName: user.name || '',
    recipientEmail: user.email,
    insertFields: true,
    status: DocumentStatus.PENDING,
  });

  const token = envelope.recipients[0].token;

  const signUrl = `/sign/${token}`;

  await apiSignin({
    page,
    email: user.email,
    redirectPath: signUrl,
  });

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);

  await expect(async () => {
    const { status } = await prisma.envelope.findFirstOrThrow({
      where: {
        id: envelope.id,
      },
    });

    expect(status).toBe(DocumentStatus.COMPLETED);
  }).toPass({
    timeout: 10000,
  });

  const completedDocument = await prisma.envelope.findFirstOrThrow({
    where: {
      id: envelope.id,
    },
    include: {
      envelopeItems: {
        orderBy: {
          order: 'asc',
        },
        include: {
          documentData: true,
        },
      },
    },
  });

  await Promise.all(
    completedDocument.envelopeItems.map(async (item) => {
      const pdfData = await getFile(item.documentData);

      const pdfImages = await renderPdfToImage(pdfData);

      for (const [index, { image }] of pdfImages.entries()) {
        fs.writeFileSync(
          `packages/app-tests/visual-regression/${item.title}-${index}.png`,
          new Uint8Array(image),
        );
      }
    }),
  );
});

async function renderPdfToImage(pdfBytes: Uint8Array) {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;

  // Increase for higher resolution
  const scale = 2;

  return await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, index) => {
      const page = await pdf.getPage(index + 1);

      const viewport = page.getViewport({ scale });
      const virtualCanvas = new Canvas(viewport.width, viewport.height);
      const context = virtualCanvas.getContext('2d');

      // @ts-expect-error skia-canvas context satisfies runtime requirements for pdfjs
      await page.render({ canvasContext: context, viewport }).promise;

      return {
        image: await virtualCanvas.toBuffer('png'),

        // Rounded down because the certificate page somehow gives dimensions with decimals
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
      };
    }),
  );
}

type CompareSignedPdfWithImagesOptions = {
  id: string;
  pdfData: Uint8Array;
  images: Buffer[];
  testInfo: TestInfo;
};

const compareSignedPdfWithImages = async ({
  id,
  pdfData,
  images,
  testInfo,
}: CompareSignedPdfWithImagesOptions) => {
  const renderedImages = await renderPdfToImage(pdfData);

  for (const [index, { image, width, height }] of renderedImages.entries()) {
    const isCertificate = index === renderedImages.length - 1;

    const diff = new PNG({ width, height });

    const storedImage = new Uint8Array(PNG.sync.read(images[index]).data);

    const newImage = new Uint8Array(PNG.sync.read(image).data);

    const comparison = pixelMatch(
      storedImage,
      newImage,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      diff.data as unknown as Uint8Array,
      width,
      height,
      {
        threshold: 0,
        // includeAA: true, // This allows stricter testing.
      },
    );
    console.log(`${id}-${index}: ${comparison}`);

    const filePath = testInfo.outputPath(`diff-${id}-${index}.png`);

    fs.writeFileSync(filePath, new Uint8Array(PNG.sync.write(diff)));

    if (isCertificate) {
      expect(comparison).toBeLessThan(20000);
    } else {
      expect(comparison).toEqual(0);
    }
  }
};
