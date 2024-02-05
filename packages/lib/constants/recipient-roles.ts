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
