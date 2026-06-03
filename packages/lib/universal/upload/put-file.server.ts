// ABOUTME: Server-side file upload pipeline for PDF and office documents.
// ABOUTME: Handles DOCX/DOC conversion to PDF, encrypted PDF decryption, and storage routing.
import { PDF } from '@libpdf/core';
import { DocumentDataType } from '@prisma/client';
import { base64 } from '@scure/base';
import { match } from 'ts-pattern';

import { env } from '@documenso/lib/utils/env';

import { AppError } from '../../errors/app-error';
import { createDocumentData } from '../../server-only/document-data/create-document-data';
import { normalizePdf } from '../../server-only/pdf/normalize-pdf';
import { convertToPdf } from '../../server-only/utils/convert-to-pdf';
import { decryptPdf } from '../../server-only/utils/decrypt-pdf';
import { uploadS3File } from './server-actions';

const OFFICE_EXTENSIONS: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
};

const getOfficeExtension = (file: File): string | null => {
  if (OFFICE_EXTENSIONS[file.type]) {
    return OFFICE_EXTENSIONS[file.type];
  }
  const lower = file.name.toLowerCase();
  for (const ext of Object.values(OFFICE_EXTENSIONS)) {
    if (lower.endsWith(`.${ext}`)) {
      return ext;
    }
  }
  return null;
};

type File = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Uploads a document file to the appropriate storage location and creates
 * a document data record.
 */
export const putPdfFileServerSide = async (file: File, initialData?: string) => {
  const originalBuffer = await file.arrayBuffer();
  let fileName = file.name;

  const officeExt = getOfficeExtension(file);
  const convertedBuffer = officeExt
    ? await convertToPdf(Buffer.from(originalBuffer), officeExt)
    : null;
  const arrayBuffer = convertedBuffer
    ? convertedBuffer.buffer.slice(
        convertedBuffer.byteOffset,
        convertedBuffer.byteOffset + convertedBuffer.byteLength,
      )
    : originalBuffer;

  if (officeExt) {
    fileName = fileName.replace(/\.[^.]+$/, '.pdf');
    if (!fileName.endsWith('.pdf')) {
      fileName = `${fileName}.pdf`;
    }
  }

  const pdf = await PDF.load(new Uint8Array(arrayBuffer)).catch((e) => {
    console.error(`PDF upload parse error: ${e.message}`);

    throw new AppError('INVALID_DOCUMENT_FILE');
  });

  if (pdf.isEncrypted) {
    const decrypted = await decryptPdf(Buffer.from(arrayBuffer));
    const decryptedBuffer = decrypted.buffer.slice(
      decrypted.byteOffset,
      decrypted.byteOffset + decrypted.byteLength,
    );

    const decryptedPdf = await PDF.load(new Uint8Array(decryptedBuffer)).catch((e) => {
      console.error(`PDF upload parse error after decryption: ${e.message}`);
      throw new AppError('INVALID_DOCUMENT_FILE');
    });

    if (!fileName.endsWith('.pdf')) {
      fileName = `${fileName}.pdf`;
    }

    const uploadFile: File = {
      name: fileName,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(decryptedBuffer),
    };

    const { type, data } = await putFileServerSide(uploadFile);
    const createdData = await createDocumentData({ type, data, initialData });

    return {
      documentData: createdData,
      filePageCount: decryptedPdf.getPageCount(),
    };
  }

  if (!fileName.endsWith('.pdf')) {
    fileName = `${fileName}.pdf`;
  }

  const uploadFile: File = {
    name: fileName,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(arrayBuffer),
  };

  const { type, data } = await putFileServerSide(uploadFile);

  const createdData = await createDocumentData({ type, data, initialData });

  return {
    documentData: createdData,
    filePageCount: pdf.getPageCount(),
  };
};

/**
 * Uploads a pdf file and normalizes it.
 */
export const putNormalizedPdfFileServerSide = async (
  file: File,
  options: { flattenForm?: boolean } = {},
) => {
  let arrayBuffer = await file.arrayBuffer();
  let fileName = file.name;

  const officeExt = getOfficeExtension(file);
  if (officeExt) {
    const converted = await convertToPdf(Buffer.from(arrayBuffer), officeExt);
    arrayBuffer = converted.buffer.slice(
      converted.byteOffset,
      converted.byteOffset + converted.byteLength,
    );
    fileName = fileName.replace(/\.[^.]+$/, '.pdf');
    if (!fileName.endsWith('.pdf')) {
      fileName = `${fileName}.pdf`;
    }
  }

  const buffer = Buffer.from(arrayBuffer);

  const normalized = await normalizePdf(buffer, options);

  if (!fileName.endsWith('.pdf')) {
    fileName = `${fileName}.pdf`;
  }

  const documentData = await putFileServerSide({
    name: fileName,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(normalized),
  });

  return await createDocumentData({
    type: documentData.type,
    data: documentData.data,
  });
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
