import { DocumentStatus } from '@documenso/prisma/client';

export const isDocumentStatus = (value: unknown): value is DocumentStatus => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return Object.values(DocumentStatus).includes(value as DocumentStatus);
};
