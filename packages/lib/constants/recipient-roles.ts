import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/macro';

import { RecipientRole } from '@documenso/prisma/client';

export const RECIPIENT_ROLES_DESCRIPTION = {
  [RecipientRole.APPROVER]: {
    actionVerb: msg`Approve`,
    actioned: msg`Approved`,
    progressiveVerb: msg`Approving`,
    roleName: msg`Approver`,
  },
  [RecipientRole.CC]: {
    actionVerb: msg`CC`,
    actioned: msg`CC'd`,
    progressiveVerb: msg`CC`,
    roleName: msg`Cc`,
  },
  [RecipientRole.SIGNER]: {
    actionVerb: msg`Sign`,
    actioned: msg`Signed`,
    progressiveVerb: msg`Signing`,
    roleName: msg`Signer`,
  },
  [RecipientRole.VIEWER]: {
    actionVerb: msg`View`,
    actioned: msg`Viewed`,
    progressiveVerb: msg`Viewing`,
    roleName: msg`Viewer`,
  },
} satisfies Record<keyof typeof RecipientRole, unknown>;

/**
 * Raw english descriptions for emails.
 *
 * Todo: Handle i18n for emails.
 */
export const RECIPIENT_ROLES_DESCRIPTION_ENG = {
  [RecipientRole.APPROVER]: {
    actionVerb: `Approve`,
    actioned: `Approved`,
    progressiveVerb: `Approving`,
    roleName: `Approver`,
    roleNamePlural: msg`Approvers`,
  },
  [RecipientRole.CC]: {
    actionVerb: `CC`,
    actioned: `CC'd`,
    progressiveVerb: `CC`,
    roleName: `Cc`,
    roleNamePlural: msg`Ccers`,
  },
  [RecipientRole.SIGNER]: {
    actionVerb: `Sign`,
    actioned: `Signed`,
    progressiveVerb: `Signing`,
    roleName: `Signer`,
    roleNamePlural: msg`Signers`,
  },
  [RecipientRole.VIEWER]: {
    actionVerb: `View`,
    actioned: `Viewed`,
    progressiveVerb: `Viewing`,
    roleName: `Viewer`,
    roleNamePlural: msg`Viewers`,
  },
} satisfies Record<keyof typeof RecipientRole, unknown>;

export const RECIPIENT_ROLE_TO_EMAIL_TYPE = {
  [RecipientRole.SIGNER]: `SIGNING_REQUEST`,
  [RecipientRole.VIEWER]: `VIEW_REQUEST`,
  [RecipientRole.APPROVER]: `APPROVE_REQUEST`,
} as const;

export const RECIPIENT_ROLE_SIGNING_REASONS = {
  [RecipientRole.SIGNER]: msg`I am a signer of this document`,
  [RecipientRole.APPROVER]: msg`I am an approver of this document`,
  [RecipientRole.CC]: msg`I am required to receive a copy of this document`,
  [RecipientRole.VIEWER]: msg`I am a viewer of this document`,
} satisfies Record<keyof typeof RecipientRole, MessageDescriptor>;
