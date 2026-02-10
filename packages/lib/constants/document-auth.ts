import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import type { TDocumentAuth } from '../types/document-auth';
import { DocumentAuth } from '../types/document-auth';

type DocumentAuthTypeData = {
  key: TDocumentAuth;
  value: MessageDescriptor;
};

export const DOCUMENT_AUTH_TYPES: Record<string, DocumentAuthTypeData> = {
  [DocumentAuth.ACCOUNT]: {
    key: DocumentAuth.ACCOUNT,
    value: msg`Require account`,
  },
  [DocumentAuth.PASSKEY]: {
    key: DocumentAuth.PASSKEY,
    value: msg`Require passkey`,
  },
  [DocumentAuth.TWO_FACTOR_AUTH]: {
    key: DocumentAuth.TWO_FACTOR_AUTH,
    value: msg`Require 2FA`,
  },
  [DocumentAuth.PASSWORD]: {
    key: DocumentAuth.PASSWORD,
    value: msg`Require password`,
  },
  [DocumentAuth.EXTERNAL_TWO_FACTOR_AUTH]: {
    key: DocumentAuth.EXTERNAL_TWO_FACTOR_AUTH,
    value: msg`Require external 2FA`,
  },
  [DocumentAuth.EXPLICIT_NONE]: {
    key: DocumentAuth.EXPLICIT_NONE,
    value: msg`None (Overrides global settings)`,
  },
} satisfies Record<TDocumentAuth, DocumentAuthTypeData>;
