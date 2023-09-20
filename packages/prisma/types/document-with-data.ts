import { Document, DocumentData } from '@documenso/prisma/client';

export type DocumentWithData = Document & {
  documentData?: DocumentData | null;
};
