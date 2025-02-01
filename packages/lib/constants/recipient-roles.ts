import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { RecipientRole } from '@prisma/client';

export const RECIPIENT_ROLES_DESCRIPTION = {
  [RecipientRole.APPROVER]: {
    actionVerb: msg`Approve`,
    actioned: msg`Approved`,
    progressiveVerb: msg`Approving`,
    roleName: msg`Approver`,
    roleNamePlural: msg`Approvers`,
  },
  [RecipientRole.CC]: {
    actionVerb: msg`CC`,
    actioned: msg`CC'd`,
    progressiveVerb: msg`CC`,
    roleName: msg`Cc`,
    roleNamePlural: msg`Ccers`,
  },
  [RecipientRole.SIGNER]: {
    actionVerb: msg`Sign`,
    actioned: msg`Signed`,
    progressiveVerb: msg`Signing`,
    roleName: msg`Signer`,
    roleNamePlural: msg`Signers`,
  },
  [RecipientRole.VIEWER]: {
    actionVerb: msg`View`,
    actioned: msg`Viewed`,
    progressiveVerb: msg`Viewing`,
    roleName: msg`Viewer`,
    roleNamePlural: msg`Viewers`,
  },
  [RecipientRole.ASSISTANT]: {
    actionVerb: msg`Assist`,
    actioned: msg`Assisted`,
    progressiveVerb: msg`Assisting`,
    roleName: msg`Assistant`,
    roleNamePlural: msg`Assistants`,
  },
} satisfies Record<keyof typeof RecipientRole, unknown>;

export const RECIPIENT_ROLE_TO_DISPLAY_TYPE = {
  [RecipientRole.SIGNER]: `SIGNING_REQUEST`,
  [RecipientRole.VIEWER]: `VIEW_REQUEST`,
  [RecipientRole.APPROVER]: `APPROVE_REQUEST`,
} as const;

export const RECIPIENT_ROLE_TO_EMAIL_TYPE = {
  [RecipientRole.SIGNER]: `SIGNING_REQUEST`,
  [RecipientRole.VIEWER]: `VIEW_REQUEST`,
  [RecipientRole.APPROVER]: `APPROVE_REQUEST`,
  [RecipientRole.ASSISTANT]: `ASSISTING_REQUEST`,
} as const;

export const RECIPIENT_ROLE_SIGNING_REASONS = {
  [RecipientRole.SIGNER]: msg`I am a signer of this document`,
  [RecipientRole.APPROVER]: msg`I am an approver of this document`,
  [RecipientRole.CC]: msg`I am required to receive a copy of this document`,
  [RecipientRole.VIEWER]: msg`I am a viewer of this document`,
  [RecipientRole.ASSISTANT]: msg`I am an assistant of this document`,
} satisfies Record<keyof typeof RecipientRole, MessageDescriptor>;
