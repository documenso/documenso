import { env } from '@documenso/lib/utils/env';
import { PDF } from '@libpdf/core';
import { DocumentDataType } from '@prisma/client';
import { base64 } from '@scure/base';
import { match } from 'ts-pattern';

import { AppError } from '../../errors/app-error';
import { createDocumentData } from '../../server-only/document-data/create-document-data';
import { normalizePdf } from '../../server-only/pdf/normalize-pdf';
import { uploadS3File } from './server-actions';

type File = {
  name: string;
  type: string;

  /**
   * The bytes to store. A `Uint8Array` (including a Node `Buffer`) is
   * accepted as-is since the consumers below only ever read the view's
   * bytes, so callers don't need to copy into a standalone `ArrayBuffer`.
   */
  arrayBuffer: () => Promise<ArrayBuffer | Uint8Array>;
};

/**
 * Uploads a document file to the appropriate storage location and creates
 * a document data record.
 */
export const putPdfFileServerSide = async (file: File, initialData?: string) => {
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

  const createdData = await createDocumentData({ type, data, initialData });

  return {
    documentData: createdData,
    filePageCount: pdf.getPageCount(),
  };
};

type PutNormalizedPdfFileOptions = {
  flattenForm?: boolean;

  /**
   * The initial data of the created document data, e.g. the source file when
   * copying one. Defaults to the uploaded file.
   */
  initialData?: string;
};

/**
 * Uploads a pdf file and normalizes it.
 */
export const putNormalizedPdfFileServerSide = async (
  file: File,
  { initialData, ...normalizePdfOptions }: PutNormalizedPdfFileOptions = {},
) => {
  const buffer = Buffer.from(await file.arrayBuffer());

  const normalized = await normalizePdf(buffer, normalizePdfOptions);

  const fileName = file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`;

  const documentData = await putFileServerSide({
    name: fileName,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(normalized),
  });

  return await createDocumentData({
    type: documentData.type,
    data: documentData.data,
    initialData,
  });
};

/**
 * Uploads a file to the appropriate storage location.
 */
export const putFileServerSide = async (file: File) => {
  const NEXT_PUBLIC_UPLOAD_TRANSPORT = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');

  return await match(NEXT_PUBLIC_UPLOAD_TRANSPORT)
    .with('s3', async () => putFileInObjectStorage(file))
    .with('azure-blob', async () => putFileInObjectStorage(file))
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

const putFileInObjectStorage = async (file: File) => {
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
