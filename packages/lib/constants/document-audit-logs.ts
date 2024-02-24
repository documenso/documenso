import { DOCUMENT_EMAIL_TYPE } from '../types/document-audit-logs';

export const DOCUMENT_AUDIT_LOG_EMAIL_FORMAT = {
  [DOCUMENT_EMAIL_TYPE.SIGNING_REQUEST]: {
    description: 'Signing request',
  },
  [DOCUMENT_EMAIL_TYPE.VIEW_REQUEST]: {
    description: 'Viewing request',
  },
  [DOCUMENT_EMAIL_TYPE.APPROVE_REQUEST]: {
    description: 'Approval request',
  },
  [DOCUMENT_EMAIL_TYPE.CC]: {
    description: 'CC',
  },
  [DOCUMENT_EMAIL_TYPE.DOCUMENT_COMPLETED]: {
    description: 'Document completed',
  },
} satisfies Record<keyof typeof DOCUMENT_EMAIL_TYPE, unknown>;
