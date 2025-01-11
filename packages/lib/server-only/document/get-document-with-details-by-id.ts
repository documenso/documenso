import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import {
  DocumentDataSchema,
  DocumentMetaSchema,
  DocumentSchema,
  FieldSchema,
  RecipientSchema,
} from '@documenso/prisma/generated/zod';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getDocumentWhereInput } from './get-document-by-id';

export type GetDocumentWithDetailsByIdOptions = {
  documentId: number;
  userId: number;
  teamId?: number;
};

export const ZGetDocumentWithDetailsByIdResponseSchema = DocumentSchema.extend({
  documentData: DocumentDataSchema,
  documentMeta: DocumentMetaSchema.nullable(),
  recipients: RecipientSchema.array(),
  fields: FieldSchema.array(),
});

export type TGetDocumentWithDetailsByIdResponse = z.infer<
  typeof ZGetDocumentWithDetailsByIdResponseSchema
>;

export const getDocumentWithDetailsById = async ({
  documentId,
  userId,
  teamId,
}: GetDocumentWithDetailsByIdOptions): Promise<TGetDocumentWithDetailsByIdResponse> => {
  const documentWhereInput = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    include: {
      documentData: true,
      documentMeta: true,
      recipients: true,
      fields: true,
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  return document;
};
