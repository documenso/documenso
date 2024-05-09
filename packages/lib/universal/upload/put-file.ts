import { base64 } from '@scure/base';
import { env } from 'next-runtime-env';
import { PDFDocument } from 'pdf-lib';
import { match } from 'ts-pattern';

import { getFlag } from '@documenso/lib/universal/get-feature-flag';
import { DocumentDataType } from '@documenso/prisma/client';

import { AppError } from '../../errors/app-error';
import { createDocumentData } from '../../server-only/document-data/create-document-data';

type File = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Uploads a document file to the appropriate storage location and creates
 * a document data record.
 */
export const putPdfFile = async (file: File) => {
  const isEncryptedDocumentsAllowed = await getFlag('app_allow_encrypted_documents').catch(
    () => false,
  );

  // This will prevent uploading encrypted PDFs or anything that can't be opened.
  if (!isEncryptedDocumentsAllowed) {
    await PDFDocument.load(await file.arrayBuffer()).catch((e) => {
      console.error(`PDF upload parse error: ${e.message}`);

      throw new AppError('INVALID_DOCUMENT_FILE');
    });
  }

  const { type, data } = await putFile(file);

  return await createDocumentData({ type, data });
};

/**
 * Uploads a file to the appropriate storage location.
 */
export const putFile = async (file: File) => {
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
  const { getPresignPostUrl } = await import('./server-actions');

  const { url, key } = await getPresignPostUrl(file.name, file.type);

  const body = await file.arrayBuffer();

  const reponse = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body,
  });

  if (!reponse.ok) {
    throw new Error(
      `Failed to upload file "${file.name}", failed with status code ${reponse.status}`,
    );
  }

  return {
    type: DocumentDataType.S3_PATH,
    data: key,
  };
};
