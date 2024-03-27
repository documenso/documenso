import type { TDocumentAuth } from '../types/document-auth';
import { DocumentAuth } from '../types/document-auth';

type DocumentAuthTypeData = {
  key: TDocumentAuth;
  value: string;

  /**
   * Whether this authentication event will require the user to halt and
   * redirect.
   *
   * Defaults to false.
   */
  isAuthRedirectRequired?: boolean;
};

export const DOCUMENT_AUTH_TYPES: Record<string, DocumentAuthTypeData> = {
  [DocumentAuth.ACCOUNT]: {
    key: DocumentAuth.ACCOUNT,
    value: 'Require account',
    isAuthRedirectRequired: true,
  },
  [DocumentAuth.PASSKEY]: {
    key: DocumentAuth.PASSKEY,
    value: 'Require passkey',
  },
  [DocumentAuth.TWO_FACTOR_AUTH]: {
    key: DocumentAuth.TWO_FACTOR_AUTH,
    value: 'Require 2FA',
  },
  [DocumentAuth.EXPLICIT_NONE]: {
    key: DocumentAuth.EXPLICIT_NONE,
    value: 'None (Overrides global settings)',
  },
} satisfies Record<TDocumentAuth, DocumentAuthTypeData>;
