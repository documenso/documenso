import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import { DocumentVisibility } from '@documenso/lib/types/document-visibility';

import type { TDocumentVisibility } from '../types/document-visibility';

type DocumentVisibilityTypeData = {
  key: TDocumentVisibility;
  value: MessageDescriptor;
};

export const DOCUMENT_VISIBILITY: Record<string, DocumentVisibilityTypeData> = {
  [DocumentVisibility.ADMIN]: {
    key: DocumentVisibility.ADMIN,
    value: msg`Admins only`,
  },
  [DocumentVisibility.EVERYONE]: {
    key: DocumentVisibility.EVERYONE,
    value: msg`Everyone`,
  },
  [DocumentVisibility.MANAGER_AND_ABOVE]: {
    key: DocumentVisibility.MANAGER_AND_ABOVE,
    value: msg`Managers and above`,
  },
} satisfies Record<TDocumentVisibility, DocumentVisibilityTypeData>;
