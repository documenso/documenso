'use server';

import { prisma } from '@documenso/prisma';
import { DocumentDataType, User } from '@documenso/prisma/client';
import { client } from '../../../../apps/web/src/trigger';

export type CreateDocumentDataOptions = {
  type: DocumentDataType;
  data: string;
  user: User
};

export const createDocumentData = async ({ type, data, user }: CreateDocumentDataOptions) => {
  const docId = await prisma.documentData.create({
    data: {
      type,
      data,
      initialData: data,
    },
  });

  await client.sendEvent({
    name: 'embedNewDocTime',
    payload: {
      userId: user.id,
      docId: docId,
    },
  });
};
