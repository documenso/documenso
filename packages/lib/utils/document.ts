import type { Document } from '@prisma/client';
import { DocumentStatus } from '@prisma/client';

export const isDocumentCompleted = (document: Pick<Document, 'status'> | DocumentStatus) => {
  const status = typeof document === 'string' ? document : document.status;

  return status === DocumentStatus.COMPLETED || status === DocumentStatus.REJECTED;
};
