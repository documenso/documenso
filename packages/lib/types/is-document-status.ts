import { DocumentStatus } from '@documenso/prisma/client';

export const isDocumentStatus = (value: unknown): value is DocumentStatus => {
  return Object.values(DocumentStatus).includes(value as DocumentStatus);
};
