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
  // [DocumentAuthType.PASSKEY]: {
  //   key: DocumentAuthType.PASSKEY,
  //   value: 'Require passkey',
  // },
  [DocumentAuth.EXPLICIT_NONE]: {
    key: DocumentAuth.EXPLICIT_NONE,
    value: 'None (Overrides global settings)',
  },
} satisfies Record<TDocumentAuth, DocumentAuthTypeData>;
