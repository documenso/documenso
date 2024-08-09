import type { TDocumentVisibility } from '../types/document-visibility';
import { DocumentVisibility } from '../types/document-visibility';

type DocumentVisibilityTypeData = {
  key: TDocumentVisibility;
  value: string;
};

export const DOCUMENT_VISIBILITY: Record<string, DocumentVisibilityTypeData> = {
  [DocumentVisibility.ADMIN]: {
    key: DocumentVisibility.ADMIN,
    value: 'Admins only',
  },
  [DocumentVisibility.EVERYONE]: {
    key: DocumentVisibility.EVERYONE,
    value: 'Everyone',
  },
  [DocumentVisibility.MANAGERANDABOVE]: {
    key: DocumentVisibility.MANAGERANDABOVE,
    value: 'Managers and above',
  },
} satisfies Record<TDocumentVisibility, DocumentVisibilityTypeData>;
