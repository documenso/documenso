import { DocumentStatus } from '@prisma/client';

export const ExtendedDocumentStatus = {
  ...DocumentStatus,
  INBOX: 'INBOX',
  ERROR: 'ERROR',
  ALL: 'ALL',
} as const;

export type ExtendedDocumentStatus =
  (typeof ExtendedDocumentStatus)[keyof typeof ExtendedDocumentStatus];
