import { PDF } from '@libpdf/core';
import { DocumentDataType } from '@prisma/client';
import { base64 } from '@scure/base';
import pMap from 'p-map';
import { match } from 'ts-pattern';

import type { TDocumentDataMeta } from '@documenso/lib/types/document-data';
import { ZDocumentDataMetaSchema } from '@documenso/lib/types/document-data';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import { pdfToImages } from '../../server-only/ai/pdf-to-images';
import { createDocumentData } from '../../server-only/document-data/create-document-data';
import { normalizePdf } from '../../server-only/pdf/normalize-pdf';
import { getEnvelopeItemPageImageS3Key } from '../../utils/envelope-images';
import { uploadS3File } from './server-actions';

type File = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Uploads a document file to the appropriate storage location and creates
 * a document data record.
 */
export const putPdfFileServerSide = async (file: File) => {
  const isEncryptedDocumentsAllowed = false; // Was feature flag.

  const arrayBuffer = await file.arrayBuffer();

  const pdf = await PDF.load(new Uint8Array(arrayBuffer)).catch((e) => {
    console.error(`PDF upload parse error: ${e.message}`);

    throw new AppError('INVALID_DOCUMENT_FILE');
  });

  if (!isEncryptedDocumentsAllowed && pdf.isEncrypted) {
    throw new AppError('INVALID_DOCUMENT_FILE');
  }

  if (!file.name.endsWith('.pdf')) {
    file.name = `${file.name}.pdf`;
  }

  const { type, data } = await putFileServerSide(file);

  const newDocumentData = await createDocumentData({ type, data });

  void extractAndStorePdfImages(arrayBuffer, newDocumentData.id);

  return newDocumentData;
};

/**
 * Extract and stores page images and metadata to S3.
 */
export const extractAndStorePdfImages = async (
  arrayBuffer: ArrayBuffer,
  documentDataId: string,
) => {
  const images = await pdfToImages(new Uint8Array(arrayBuffer));

  const pageMetadata = images.map((image) => ({
    originalWidth: image.originalWidth,
    originalHeight: image.originalHeight,
    scale: image.scale,
    scaledWidth: image.scaledWidth,
    scaledHeight: image.scaledHeight,
  }));

  const documentDataMetadata = ZDocumentDataMetaSchema.parse({
    pages: pageMetadata,
  } satisfies TDocumentDataMeta);

  const updatedDocumentData = await prisma.documentData.update({
    where: { id: documentDataId },
    data: {
      metadata: documentDataMetadata,
    },
  });

  if (
    env('NEXT_PUBLIC_UPLOAD_TRANSPORT') === 's3' &&
    updatedDocumentData.type === DocumentDataType.S3_PATH
  ) {
    await pMap(
      images,
      async (image) => {
        const imageBlob = new Blob([new Uint8Array(image.image)], { type: 'image/jpeg' });

        const pageIndex = image.pageIndex;

        const s3Key = getEnvelopeItemPageImageS3Key(updatedDocumentData.data, pageIndex);

        const imageFile = new File([imageBlob], `${pageIndex}.jpeg`, {
          type: 'image/jpeg',
        });

        const { key } = await uploadS3File(imageFile, s3Key);

        return key;
      },
      { concurrency: 100 },
    );
  }

  return pageMetadata;
};

/**
 * Uploads a pdf file and normalizes it.
 */
export const putNormalizedPdfFileServerSide = async (
  file: File,
  options: { flattenForm?: boolean } = {},
) => {
  const buffer = Buffer.from(await file.arrayBuffer());

  const normalized = await normalizePdf(buffer, options);

  const fileName = file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`;

  const documentData = await putFileServerSide({
    name: fileName,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(normalized),
  });

  const newDocumentData = await createDocumentData({
    type: documentData.type,
    data: documentData.data,
  });

  void extractAndStorePdfImages(normalized, newDocumentData.id);

  return newDocumentData;
};

/**
 * Uploads a file to the appropriate storage location.
 */
export const putFileServerSide = async (file: File) => {
  const NEXT_PUBLIC_UPLOAD_TRANSPORT = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');

  return await match(NEXT_PUBLIC_UPLOAD_TRANSPORT)
    .with('s3', async () => putFileInS3(file))
    .otherwise(async () => putFileInDatabase(file));
};

const putFileInDatabase = async (file: File) => {
  const contents = await file.arrayBuffer();

  const binaryData = new Uint8Array(contents);

  const asciiData = base64.encode(binaryData);

  return {
    type: DocumentDataType.BYTES_64,
    data: asciiData,
  };
};

const putFileInS3 = async (file: File) => {
  const buffer = await file.arrayBuffer();

  const blob = new Blob([buffer], { type: file.type });

  const newFile = new File([blob], file.name, {
    type: file.type,
  });

  const { key } = await uploadS3File(newFile);

  return {
    type: DocumentDataType.S3_PATH,
    data: key,
  };
};
