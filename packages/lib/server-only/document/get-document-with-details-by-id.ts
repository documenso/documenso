import { prisma } from '@documenso/prisma';
import type { DocumentWithDetails } from '@documenso/prisma/types/document';

import { getDocumentWhereInput } from './get-document-by-id';

export type GetDocumentWithDetailsByIdOptions = {
  id: number;
  userId: number;
  teamId?: number;
};

export const getDocumentWithDetailsById = async ({
  id,
  userId,
  teamId,
}: GetDocumentWithDetailsByIdOptions): Promise<DocumentWithDetails> => {
  const documentWhereInput = await getDocumentWhereInput({
    documentId: id,
    userId,
    teamId,
  });

  return await prisma.document.findFirstOrThrow({
    where: documentWhereInput,
    include: {
      documentData: true,
      documentMeta: true,
      Recipient: true,
      Field: true,
    },
  });
};
