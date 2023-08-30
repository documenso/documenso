import { ExtendedDocumentStatus } from '../types/extended-document-status';

export const isExtendedDocumentStatus = (value: unknown): value is ExtendedDocumentStatus => {
  if (typeof value !== 'string') {
    return false;
  }

  // We're using the assertion for a type-guard so it's safe to ignore the eslint warning
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return Object.values(ExtendedDocumentStatus).includes(value as ExtendedDocumentStatus);
};
