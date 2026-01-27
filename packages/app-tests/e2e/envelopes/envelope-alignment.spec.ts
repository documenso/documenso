import { createCanvas } from '@napi-rs/canvas';
import type { TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentStatus, EnvelopeType } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pixelMatch from 'pixelmatch';
import { PNG } from 'pngjs';

import { getEnvelopeItemPdfUrl } from '@documenso/lib/utils/envelope-download';
import { prisma } from '@documenso/prisma';
import { seedAlignmentTestDocument } from '@documenso/prisma/seed/initial-seed';
import { seedUser } from '@documenso/prisma/seed/users';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../../lib/constants/app';
import { isBase64Image } from '../../../lib/constants/signatures';
import { createApiToken } from '../../../lib/server-only/public-api/create-api-token';
import { RecipientRole } from '../../../prisma/generated/types';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '../../../trpc/server/envelope-router/create-envelope.types';
import type { TDistributeEnvelopeRequest } from '../../../trpc/server/envelope-router/distribute-envelope.types';
import { ALIGNMENT_TEST_FIELDS } from '../../constants/field-alignment-pdf';
import { FIELD_META_TEST_FIELDS } from '../../constants/field-meta-pdf';
import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2`;

test.describe.configure({ mode: 'parallel', timeout: 60000 });

test.skip('seed alignment test document', async ({ page }) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      email: 'example@documenso.com',
    },
    include: {
      ownedOrganisations: {
        include: {
          teams: true,
        },
      },
    },
  });

  const userId = user.id;
  const teamId = user.ownedOrganisations[0].teams[0].id;

  await seedAlignmentTestDocument({
    userId,
    teamId,
    recipientName: user.name || '',
    recipientEmail: user.email,
    insertFields: false,
    status: DocumentStatus.DRAFT,
  });
});

test('field placement visual regression', async ({ page, request }, testInfo) => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test',
    expiresIn: null,
  });

  // Step 1: Create initial envelope with Prisma (with first envelope item)
  const alignmentPdf = fs.readFileSync(
    path.join(__dirname, '../../../../assets/field-font-alignment.pdf'),
  );

  const fieldMetaPdf = fs.readFileSync(path.join(__dirname, '../../../../assets/field-meta.pdf'));

  const formData = new FormData();

  const fieldMetaFields = FIELD_META_TEST_FIELDS.map((field) => ({
    identifier: 'field-meta',
    type: field.type,
    page: field.page,
    positionX: field.positionX,
    positionY: field.positionY,
    width: field.width,
    height: field.height,
    fieldMeta: field.fieldMeta,
  }));

  const alignmentFields = ALIGNMENT_TEST_FIELDS.map((field) => ({
    identifier: 'alignment-pdf',
    type: field.type,
    page: field.page,
    positionX: field.positionX,
    positionY: field.positionY,
    width: field.width,
    height: field.height,
    fieldMeta: field.fieldMeta,
  }));

  const createEnvelopePayload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: 'Envelope Full Field Test',
    recipients: [
      {
        email: user.email,
        name: user.name || '',
        role: RecipientRole.SIGNER,
        fields: [...fieldMetaFields, ...alignmentFields],
      },
    ],
  };

  formData.append('payload', JSON.stringify(createEnvelopePayload));

  formData.append('files', new File([alignmentPdf], 'alignment-pdf', { type: 'application/pdf' }));
  formData.append('files', new File([fieldMetaPdf], 'field-meta', { type: 'application/pdf' }));

  const createEnvelopeRequest = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });

  expect(createEnvelopeRequest.ok()).toBeTruthy();
  expect(createEnvelopeRequest.status()).toBe(200);

  const { id: createdEnvelopeId }: TCreateEnvelopeResponse = await createEnvelopeRequest.json();

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: {
      id: createdEnvelopeId,
    },
    include: {
      recipients: true,
      envelopeItems: true,
    },
  });

  const recipientId = envelope.recipients[0].id;
  const alignmentItem = envelope.envelopeItems.find((item: { order: number }) => item.order === 1);
  const fieldMetaItem = envelope.envelopeItems.find((item: { order: number }) => item.order === 2);

  expect(recipientId).toBeDefined();
  expect(alignmentItem).toBeDefined();
  expect(fieldMetaItem).toBeDefined();

  if (!alignmentItem || !fieldMetaItem) {
    throw new Error('Envelope items not found');
  }

  const distributeEnvelopeRequest = await request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      envelopeId: envelope.id,
    } satisfies TDistributeEnvelopeRequest,
  });

  expect(distributeEnvelopeRequest.ok()).toBeTruthy();

  const uninsertedFields = await prisma.field.findMany({
    where: {
      envelopeId: envelope.id,
      inserted: false,
    },
    include: {
      envelopeItem: {
        select: {
          title: true,
        },
      },
    },
  });

  await Promise.all(
    uninsertedFields.map(async (field) => {
      let foundField = ALIGNMENT_TEST_FIELDS.find(
        (f) =>
          field.page === f.page &&
          field.envelopeItem.title === 'alignment-pdf' &&
          Number(field.positionX).toFixed(2) === f.positionX.toFixed(2) &&
          Number(field.positionY).toFixed(2) === f.positionY.toFixed(2) &&
          Number(field.width).toFixed(2) === f.width.toFixed(2) &&
          Number(field.height).toFixed(2) === f.height.toFixed(2),
      );

      if (!foundField) {
        foundField = FIELD_META_TEST_FIELDS.find(
          (f) =>
            field.page === f.page &&
            field.envelopeItem.title === 'field-meta' &&
            Number(field.positionX).toFixed(2) === f.positionX.toFixed(2) &&
            Number(field.positionY).toFixed(2) === f.positionY.toFixed(2) &&
            Number(field.width).toFixed(2) === f.width.toFixed(2) &&
            Number(field.height).toFixed(2) === f.height.toFixed(2),
        );
      }

      if (!foundField) {
        throw new Error('Field not found');
      }

      await prisma.field.update({
        where: {
          id: field.id,
        },
        data: {
          inserted: true,
          customText: foundField.customText,
          signature: foundField.signature
            ? {
                create: {
                  recipientId: envelope.recipients[0].id,
                  signatureImageAsBase64: isBase64Image(foundField.signature)
                    ? foundField.signature
                    : null,
                  typedSignature: isBase64Image(foundField.signature) ? null : foundField.signature,
                },
              }
            : undefined,
        },
      });
    }),
  );

  const recipientToken = envelope.recipients[0].token;
  const signUrl = `/sign/${recipientToken}`;

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

  const storedImages = fs.readdirSync(path.join(__dirname, '../../visual-regression'));

  await Promise.all(
    completedDocument.envelopeItems.map(async (item) => {
      const documentUrl = getEnvelopeItemPdfUrl({
        type: 'download',
        envelopeItem: item,
        token: recipientToken,
        version: 'signed',
      });

      const pdfData = await fetch(documentUrl).then(async (res) => await res.arrayBuffer());

      const loadedImages = storedImages
        .filter((image) => image.includes(item.title))
        .map((image) => fs.readFileSync(path.join(__dirname, '../../visual-regression', image)));

      await compareSignedPdfWithImages({
        id: item.title.replaceAll(' ', '-').toLowerCase(),
        pdfData: new Uint8Array(pdfData),
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
      const documentUrl = getEnvelopeItemPdfUrl({
        type: 'download',
        envelopeItem: item,
        token,
        version: 'signed',
      });

      const pdfData = await fetch(documentUrl).then(async (res) => await res.arrayBuffer());

      const pdfImages = await renderPdfToImage(new Uint8Array(pdfData));

      for (const [index, { image }] of pdfImages.entries()) {
        fs.writeFileSync(
          path.join(__dirname, '../../visual-regression', `${item.title}-${index}.png`),
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

  const blankCertificateFile = fs.readFileSync(
    path.join(__dirname, '../../visual-regression/blank-certificate.png'),
  );
  const blankCertificateImage = PNG.sync.read(blankCertificateFile).data;

  for (const [index, { image, width, height }] of renderedImages.entries()) {
    const isCertificate = index === renderedImages.length - 1;

    const diff = new PNG({ width, height });

    const storedImage = PNG.sync.read(images[index]).data;

    const newImage = PNG.sync.read(image).data;

    const oldImage = isCertificate ? blankCertificateImage : storedImage;

    const comparison = pixelMatch(
      new Uint8Array(oldImage),
      new Uint8Array(newImage),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      diff.data as unknown as Uint8Array,
      width,
      height,
      {
        threshold: 0.25,
        // includeAA: true, // This allows stricter testing.
      },
    );
    console.log(`${id}-${index}: ${comparison}`);

    const diffFilePath = path.join(testInfo.outputPath(), `${id}-${index}-diff.png`);
    const oldFilePath = path.join(testInfo.outputPath(), `${id}-${index}-old.png`);
    const newFilePath = path.join(testInfo.outputPath(), `${id}-${index}-new.png`);

    fs.writeFileSync(diffFilePath, new Uint8Array(PNG.sync.write(diff)));
    fs.writeFileSync(oldFilePath, new Uint8Array(images[index]));
    fs.writeFileSync(newFilePath, new Uint8Array(image));

    if (isCertificate) {
      // Expect the certificate to NOT be blank. Since the storedImage is blank.
      expect.soft(comparison).toBeGreaterThan(20000);
    } else {
      expect.soft(comparison).toBeLessThan(2);
    }
  }
};
