import { base64 } from '@scure/base';
import { match } from 'ts-pattern';

import { DocumentDataType } from '@documenso/prisma/client';

import { createDocumentData } from '../../server-only/document-data/create-document-data';

type File = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export const putFile = async (file: File) => {
  const { type, data } = await match(process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT)
    .with('s3', async () => putFileInS3(file))
    .otherwise(async () => putFileInDatabase(file));

  return await createDocumentData({ type, data });
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
