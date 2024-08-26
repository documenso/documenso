import { DocumentVisibility } from '@documenso/lib/types/document-visibility';

import type { TDocumentVisibility } from '../types/document-visibility';

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
  [DocumentVisibility.MANAGER_AND_ABOVE]: {
    key: DocumentVisibility.MANAGER_AND_ABOVE,
    value: 'Managers and above',
  },
} satisfies Record<TDocumentVisibility, DocumentVisibilityTypeData>;
