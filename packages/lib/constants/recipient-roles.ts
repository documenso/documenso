import { RecipientRole } from '@documenso/prisma/client';

export const RECIPIENT_ROLES_DESCRIPTION = {
  [RecipientRole.APPROVER]: {
    actionVerb: 'Approve',
    actioned: 'Approved',
    progressiveVerb: 'Approving',
    roleName: 'Approver',
  },
  [RecipientRole.CC]: {
    actionVerb: 'CC',
    actioned: `CC'd`,
    progressiveVerb: 'CC',
    roleName: 'Cc',
  },
  [RecipientRole.SIGNER]: {
    actionVerb: 'Sign',
    actioned: 'Signed',
    progressiveVerb: 'Signing',
    roleName: 'Signer',
  },
  [RecipientRole.VIEWER]: {
    actionVerb: 'View',
    actioned: 'Viewed',
    progressiveVerb: 'Viewing',
    roleName: 'Viewer',
  },
} satisfies Record<keyof typeof RecipientRole, unknown>;

export const RECIPIENT_ROLE_TO_EMAIL_TYPE = {
  [RecipientRole.SIGNER]: 'SIGNING_REQUEST',
  [RecipientRole.VIEWER]: 'VIEW_REQUEST',
  [RecipientRole.APPROVER]: 'APPROVE_REQUEST',
} as const;

export const RECIPIENT_ROLE_SIGNING_REASONS = {
  [RecipientRole.SIGNER]: 'I am a signer of this document',
  [RecipientRole.APPROVER]: 'I am an approver of this document',
  [RecipientRole.CC]: 'I am required to recieve a copy of this document',
  [RecipientRole.VIEWER]: 'I am a viewer of this document',
} satisfies Record<keyof typeof RecipientRole, string>;
