import type { ComponentType } from 'react';

import { AccessAuth2FAEmailTemplate } from '../../../templates/access-auth-2fa';
import { AdminUserCreatedTemplate } from '../../../templates/admin-user-created';
import { BulkSendCompleteEmail } from '../../../templates/bulk-send-complete';
import { ConfirmEmailTemplate } from '../../../templates/confirm-email';
import { ConfirmTeamEmailTemplate } from '../../../templates/confirm-team-email';
import { DocumentCancelTemplate } from '../../../templates/document-cancel';
import { DocumentCompletedEmailTemplate } from '../../../templates/document-completed';
import { DocumentCreatedFromDirectTemplateEmailTemplate } from '../../../templates/document-created-from-direct-template';
import { DocumentInviteEmailTemplate } from '../../../templates/document-invite';
import { DocumentPendingEmailTemplate } from '../../../templates/document-pending';
import { DocumentRecipientSignedEmailTemplate } from '../../../templates/document-recipient-signed';
import { DocumentRejectedEmail } from '../../../templates/document-rejected';
import { DocumentRejectionConfirmedEmail } from '../../../templates/document-rejection-confirmed';
import { DocumentReminderEmailTemplate } from '../../../templates/document-reminder';
import { DocumentSelfSignedEmailTemplate } from '../../../templates/document-self-signed';
import { DocumentSuperDeleteEmailTemplate } from '../../../templates/document-super-delete';
import { ForgotPasswordTemplate } from '../../../templates/forgot-password';
import { OrganisationAccountLinkConfirmationTemplate } from '../../../templates/organisation-account-link-confirmation';
import { OrganisationDeleteEmailTemplate } from '../../../templates/organisation-delete';
import { OrganisationInviteEmailTemplate } from '../../../templates/organisation-invite';
import { OrganisationJoinEmailTemplate } from '../../../templates/organisation-join';
import { OrganisationLeaveEmailTemplate } from '../../../templates/organisation-leave';
import { OrganisationLimitAlertEmailTemplate } from '../../../templates/organisation-limit-alert';
import { RecipientExpiredTemplate } from '../../../templates/recipient-expired';
import { RecipientRemovedFromDocumentTemplate } from '../../../templates/recipient-removed-from-document';
import { ResetPasswordTemplate } from '../../../templates/reset-password';
import { TeamDeleteEmailTemplate } from '../../../templates/team-delete';
import { TeamEmailRemovedTemplate } from '../../../templates/team-email-removed';

export type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'list';

export type FieldConfig = {
  type: FieldType;
  label: string;
  description?: string;
  placeholder?: string;
  default: unknown;
  options?: { label: string; value: string }[];
};

export type TemplateDefinition = {
  /** Human label for the sidebar. */
  name: string;
  /** Loose grouping for the sidebar. */
  group: 'Documents' | 'Recipients' | 'Organisations' | 'Teams' | 'Account' | 'Admin';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  /** Editable props surfaced in the preview UI. */
  fields: Record<string, FieldConfig>;
};

// --- Reusable field presets ---

const documentNameField: FieldConfig = {
  type: 'text',
  label: 'Document name',
  default: 'Open Source Pledge.pdf',
};

const recipientNameField: FieldConfig = {
  type: 'text',
  label: 'Recipient name',
  default: 'Lucas Smith',
};

const roleField: FieldConfig = {
  type: 'select',
  label: 'Recipient role',
  default: 'SIGNER',
  options: [
    { label: 'Signer', value: 'SIGNER' },
    { label: 'Viewer', value: 'VIEWER' },
    { label: 'Approver', value: 'APPROVER' },
    { label: 'CC', value: 'CC' },
    { label: 'Assistant', value: 'ASSISTANT' },
  ],
};

/**
 * Explicit template registry. Each entry maps a slug → component + editable
 * `fields`. The slug is the route param (`/:slug`) and matches the source
 * filename (sans extension).
 *
 * `fields` drives both the default preview values AND the editable inputs in
 * the UI, so production templates stay free of preview-only defaults.
 */
export const templates: Record<string, TemplateDefinition> = {
  // ---- Documents ----
  'document-invite': {
    name: 'Document invite',
    group: 'Documents',
    component: DocumentInviteEmailTemplate,
    fields: {
      inviterName: { type: 'text', label: 'Inviter name', default: 'Lucas Smith' },
      inviterEmail: { type: 'text', label: 'Inviter email', default: 'lucas@documenso.com' },
      documentName: documentNameField,
      role: roleField,
      customBody: {
        type: 'textarea',
        label: 'Custom message',
        default: '',
        description: 'Leave blank to use the default invite copy.',
      },
    },
  },
  'document-completed': {
    name: 'Document completed',
    group: 'Documents',
    component: DocumentCompletedEmailTemplate,
    fields: {
      documentName: documentNameField,
      customBody: { type: 'textarea', label: 'Custom message', default: '' },
    },
  },
  'document-self-signed': {
    name: 'Document self-signed',
    group: 'Documents',
    component: DocumentSelfSignedEmailTemplate,
    fields: {
      documentName: documentNameField,
    },
  },
  'document-pending': {
    name: 'Document pending',
    group: 'Documents',
    component: DocumentPendingEmailTemplate,
    fields: {
      documentName: documentNameField,
    },
  },
  'document-reminder': {
    name: 'Document reminder',
    group: 'Documents',
    component: DocumentReminderEmailTemplate,
    fields: {
      recipientName: recipientNameField,
      documentName: documentNameField,
      role: roleField,
      customBody: { type: 'textarea', label: 'Custom message', default: '' },
    },
  },
  'document-cancel': {
    name: 'Document cancelled',
    group: 'Documents',
    component: DocumentCancelTemplate,
    fields: {
      inviterName: { type: 'text', label: 'Inviter name', default: 'Lucas Smith' },
      documentName: documentNameField,
      cancellationReason: {
        type: 'textarea',
        label: 'Cancellation reason',
        default: '',
        description: 'Optional. Blank renders no reason block.',
      },
    },
  },
  'document-rejected': {
    name: 'Document rejected',
    group: 'Documents',
    component: DocumentRejectedEmail,
    fields: {
      recipientName: recipientNameField,
      documentName: documentNameField,
      documentUrl: { type: 'text', label: 'Document URL', default: 'https://documenso.com' },
      rejectionReason: {
        type: 'textarea',
        label: 'Rejection reason',
        default: 'The pledge amount is incorrect.',
        description: 'Optional in production; blank renders no reason block.',
      },
    },
  },
  'document-rejection-confirmed': {
    name: 'Document rejection confirmed',
    group: 'Documents',
    component: DocumentRejectionConfirmedEmail,
    fields: {
      recipientName: recipientNameField,
      documentName: documentNameField,
      documentOwnerName: { type: 'text', label: 'Document owner', default: 'Timur Ercan' },
      reason: {
        type: 'textarea',
        label: 'Rejection reason',
        default: 'The pledge amount is incorrect.',
        description: 'Optional in production; blank renders no reason block.',
      },
    },
  },
  'document-created-from-direct-template': {
    name: 'Document created (direct template)',
    group: 'Documents',
    component: DocumentCreatedFromDirectTemplateEmailTemplate,
    fields: {
      documentName: documentNameField,
    },
  },
  'document-super-delete': {
    name: 'Document deleted (admin)',
    group: 'Documents',
    component: DocumentSuperDeleteEmailTemplate,
    fields: {
      documentName: documentNameField,
    },
  },
  'bulk-send-complete': {
    name: 'Bulk send complete',
    group: 'Documents',
    component: BulkSendCompleteEmail,
    fields: {
      userName: { type: 'text', label: 'User name', default: 'Lucas Smith' },
      templateName: { type: 'text', label: 'Template name', default: 'NDA Template' },
      totalProcessed: { type: 'number', label: 'Total processed', default: 50 },
      successCount: { type: 'number', label: 'Success count', default: 48 },
      failedCount: { type: 'number', label: 'Failed count', default: 2 },
      errors: {
        type: 'list',
        label: 'Errors',
        default: ['Row 12: invalid email', 'Row 30: missing name'],
        description: 'One error per line. Rendered when failed count > 0.',
      },
    },
  },

  // ---- Recipients ----
  'document-recipient-signed': {
    name: 'Recipient signed',
    group: 'Recipients',
    component: DocumentRecipientSignedEmailTemplate,
    fields: {
      documentName: documentNameField,
      recipientName: recipientNameField,
    },
  },
  'recipient-expired': {
    name: 'Recipient expired',
    group: 'Recipients',
    component: RecipientExpiredTemplate,
    fields: {
      documentName: documentNameField,
      recipientName: recipientNameField,
    },
  },
  'recipient-removed-from-document': {
    name: 'Recipient removed',
    group: 'Recipients',
    component: RecipientRemovedFromDocumentTemplate,
    fields: {
      documentName: documentNameField,
    },
  },

  // ---- Organisations ----
  'organisation-invite': {
    name: 'Organisation invite',
    group: 'Organisations',
    component: OrganisationInviteEmailTemplate,
    fields: {
      senderName: { type: 'text', label: 'Sender name', default: 'Lucas Smith' },
      organisationName: { type: 'text', label: 'Organisation name', default: 'Documenso' },
    },
  },
  'organisation-join': {
    name: 'Organisation join',
    group: 'Organisations',
    component: OrganisationJoinEmailTemplate,
    fields: {
      memberName: { type: 'text', label: 'Member name', default: 'Lucas Smith' },
      organisationName: { type: 'text', label: 'Organisation name', default: 'Documenso' },
    },
  },
  'organisation-leave': {
    name: 'Organisation leave',
    group: 'Organisations',
    component: OrganisationLeaveEmailTemplate,
    fields: {
      memberName: { type: 'text', label: 'Member name', default: 'Lucas Smith' },
      organisationName: { type: 'text', label: 'Organisation name', default: 'Documenso' },
    },
  },
  'organisation-delete': {
    name: 'Organisation delete',
    group: 'Organisations',
    component: OrganisationDeleteEmailTemplate,
    fields: {
      organisationName: { type: 'text', label: 'Organisation name', default: 'Documenso' },
    },
  },
  'organisation-limit-alert': {
    name: 'Organisation limit alert',
    group: 'Organisations',
    component: OrganisationLimitAlertEmailTemplate,
    fields: {
      organisationName: { type: 'text', label: 'Organisation name', default: 'Documenso' },
    },
  },
  'organisation-account-link-confirmation': {
    name: 'Account link confirmation',
    group: 'Organisations',
    component: OrganisationAccountLinkConfirmationTemplate,
    fields: {
      organisationName: { type: 'text', label: 'Organisation name', default: 'Documenso' },
    },
  },

  // ---- Teams ----
  'confirm-team-email': {
    name: 'Confirm team email',
    group: 'Teams',
    component: ConfirmTeamEmailTemplate,
    fields: {
      teamName: { type: 'text', label: 'Team name', default: 'Documenso' },
    },
  },
  'team-delete': {
    name: 'Team delete',
    group: 'Teams',
    component: TeamDeleteEmailTemplate,
    fields: {},
  },
  'team-email-removed': {
    name: 'Team email removed',
    group: 'Teams',
    component: TeamEmailRemovedTemplate,
    fields: {
      teamName: { type: 'text', label: 'Team name', default: 'Documenso' },
      teamEmail: { type: 'text', label: 'Team email', default: 'team@documenso.com' },
    },
  },

  // ---- Account ----
  'confirm-email': {
    name: 'Confirm email',
    group: 'Account',
    component: ConfirmEmailTemplate,
    fields: {
      confirmationLink: {
        type: 'text',
        label: 'Confirmation link',
        default: 'https://documenso.com/confirm',
      },
    },
  },
  'forgot-password': {
    name: 'Forgot password',
    group: 'Account',
    component: ForgotPasswordTemplate,
    fields: {
      resetPasswordLink: {
        type: 'text',
        label: 'Reset link',
        default: 'https://documenso.com/reset',
      },
    },
  },
  'reset-password': {
    name: 'Reset password',
    group: 'Account',
    component: ResetPasswordTemplate,
    fields: {
      userName: { type: 'text', label: 'User name', default: 'Lucas Smith' },
      userEmail: { type: 'text', label: 'User email', default: 'lucas@documenso.com' },
    },
  },
  'access-auth-2fa': {
    name: 'Access auth 2FA',
    group: 'Account',
    component: AccessAuth2FAEmailTemplate,
    fields: {
      documentTitle: { type: 'text', label: 'Document title', default: 'Open Source Pledge.pdf' },
      code: { type: 'text', label: 'Code', default: '123456' },
      userEmail: { type: 'text', label: 'User email', default: 'lucas@documenso.com' },
      userName: { type: 'text', label: 'User name', default: 'Lucas Smith' },
      expiresInMinutes: { type: 'number', label: 'Expires in (min)', default: 10 },
    },
  },

  // ---- Admin ----
  'admin-user-created': {
    name: 'Admin user created',
    group: 'Admin',
    component: AdminUserCreatedTemplate,
    fields: {
      resetPasswordLink: {
        type: 'text',
        label: 'Reset link',
        default: 'https://documenso.com/reset',
      },
    },
  },
};

export type TemplateId = keyof typeof templates;

/** Extract the default prop values from a template's field config. */
export const getDefaultProps = (fields: Record<string, FieldConfig>): Record<string, unknown> => {
  const props: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(fields)) {
    props[key] = field.default;
  }

  return props;
};

export const getTemplate = (slug: string): TemplateDefinition | undefined => templates[slug];
