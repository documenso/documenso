import { RecipientRole } from '@documenso/prisma/client';

export const RECIPIENT_ROLES_DESCRIPTION: {
  [key in RecipientRole]: { actionVerb: string; progressiveVerb: string; roleName: string };
} = {
  [RecipientRole.APPROVER]: {
    actionVerb: 'Approve',
    progressiveVerb: 'Approving',
    roleName: 'Approver',
  },
  [RecipientRole.CC]: {
    actionVerb: 'CC',
    progressiveVerb: 'CC',
    roleName: 'CC',
  },
  [RecipientRole.SIGNER]: {
    actionVerb: 'Sign',
    progressiveVerb: 'Signing',
    roleName: 'Signer',
  },
  [RecipientRole.VIEWER]: {
    actionVerb: 'View',
    progressiveVerb: 'Viewing',
    roleName: 'Viewer',
  },
};

export const RECIPIENT_ROLE_TO_EMAIL_TYPE = {
  [RecipientRole.SIGNER]: 'SIGNING_REQUEST',
  [RecipientRole.VIEWER]: 'VIEW_REQUEST',
  [RecipientRole.APPROVER]: 'APPROVE_REQUEST',
} as const;
