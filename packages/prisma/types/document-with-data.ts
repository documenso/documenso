<<<<<<< HEAD
import { Document, DocumentData, DocumentMeta } from '@documenso/prisma/client';
=======
import type { Document, DocumentData, DocumentMeta } from '@documenso/prisma/client';
>>>>>>> main

export type DocumentWithData = Document & {
  documentData?: DocumentData | null;
  documentMeta?: DocumentMeta | null;
};
