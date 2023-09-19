import { match } from 'ts-pattern';

import { DocumentDataType } from '@documenso/prisma/client';

import { deleteS3File } from './server-actions';

export type DeleteFileOptions = {
  type: DocumentDataType;
  data: string;
};

export const deleteFile = async ({ type, data }: DeleteFileOptions) => {
  return await match(type)
    .with(DocumentDataType.S3_PATH, async () => deleteFileFromS3(data))
    .otherwise(() => {
      return;
    });
};

const deleteFileFromS3 = async (key: string) => {
  await deleteS3File(key);
};
