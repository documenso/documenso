import { base64 } from '@scure/base';
import { match } from 'ts-pattern';

import { DocumentDataType } from '@documenso/prisma/client';

export type UpdateFileOptions = {
  type: DocumentDataType;
  oldData: string;
  newData: string;
};

export const updateFile = async ({ type, oldData, newData }: UpdateFileOptions) => {
  return await match(type)
    .with(DocumentDataType.BYTES, () => updateFileWithBytes(newData))
    .with(DocumentDataType.BYTES_64, () => updateFileWithBytes64(newData))
    .with(DocumentDataType.S3_PATH, async () => updateFileWithS3(oldData, newData))
    .exhaustive();
};

const updateFileWithBytes = (data: string) => {
  return {
    type: DocumentDataType.BYTES,
    data,
  };
};

const updateFileWithBytes64 = (data: string) => {
  const encoder = new TextEncoder();

  const binaryData = encoder.encode(data);

  const asciiData = base64.encode(binaryData);

  return {
    type: DocumentDataType.BYTES_64,
    data: asciiData,
  };
};

const updateFileWithS3 = async (key: string, data: string) => {
  const { getAbsolutePresignPostUrl } = await import('./server-actions');

  const { url } = await getAbsolutePresignPostUrl(key);

  const response = await fetch(url, {
    method: 'PUT',
    body: data,
  });

  if (!response.ok) {
    throw new Error(`Failed to update file "${key}", failed with status code ${response.status}`);
  }

  return {
    type: DocumentDataType.S3_PATH,
    data: key,
  };
};
