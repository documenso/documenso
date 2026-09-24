import { DocumentStatus } from '@prisma/client';

export const ExtendedDocumentStatus = {
  ...DocumentStatus,
  INBOX: 'INBOX',
  ALL: 'ALL',
  EXPIRED: 'EXPIRED',
  PARTIALLY_APPROVED: 'PARTIALLY_APPROVED',
} as const;

export type ExtendedDocumentStatus = (typeof ExtendedDocumentStatus)[keyof typeof ExtendedDocumentStatus];
