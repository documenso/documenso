import type { Document, DocumentData, DocumentMeta } from '@documenso/prisma/client';

export type DocumentWithData = Document & {
  documentData?: DocumentData | null;
  documentMeta?: DocumentMeta | null;
};
