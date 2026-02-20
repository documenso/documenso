import { JobClient } from './client/client';
import { SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION } from './definitions/emails/send-2fa-token-email';
import { SEND_COMPLETED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-completed-email';
import { SEND_CONFIRMATION_EMAIL_JOB_DEFINITION } from './definitions/emails/send-confirmation-email';
import { SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-direct-template-created-email';
import { SEND_DOCUMENT_CANCELLED_EMAILS_JOB_DEFINITION } from './definitions/emails/send-document-cancelled-emails';
import { SEND_DOCUMENT_DELETED_EMAILS_JOB_DEFINITION } from './definitions/emails/send-document-deleted-emails';
import { SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION } from './definitions/emails/send-document-super-delete-email';
import { SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION } from './definitions/emails/send-forgot-password-email';
import { SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-organisation-member-joined-email';
import { SEND_ORGANISATION_MEMBER_LEFT_EMAIL_JOB_DEFINITION } from './definitions/emails/send-organisation-member-left-email';
import { SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-owner-recipient-expired-email';
import { SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION } from './definitions/emails/send-password-reset-success-email';
import { SEND_PENDING_EMAIL_JOB_DEFINITION } from './definitions/emails/send-pending-email';
import { SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-recipient-removed-email';
import { SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-recipient-signed-email';
import { SEND_SIGNING_REJECTION_EMAILS_JOB_DEFINITION } from './definitions/emails/send-rejection-emails';
import { SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION } from './definitions/emails/send-resend-document-email';
import { SEND_SIGNING_EMAIL_JOB_DEFINITION } from './definitions/emails/send-signing-email';
import { SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-team-deleted-email';
import { BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION } from './definitions/internal/backport-subscription-claims';
import { BULK_SEND_TEMPLATE_JOB_DEFINITION } from './definitions/internal/bulk-send-template';
import { CLEANUP_RATE_LIMITS_JOB_DEFINITION } from './definitions/internal/cleanup-rate-limits';
import { EXECUTE_WEBHOOK_JOB_DEFINITION } from './definitions/internal/execute-webhook';
import { EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION } from './definitions/internal/expire-recipients-sweep';
import { PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION } from './definitions/internal/process-recipient-expired';
import { SEAL_DOCUMENT_JOB_DEFINITION } from './definitions/internal/seal-document';

/**
 * The `as const` assertion is load bearing as it provides the correct level of type inference for
 * triggering jobs.
 */
export const jobsClient = new JobClient([
  SEND_SIGNING_EMAIL_JOB_DEFINITION,
  SEND_CONFIRMATION_EMAIL_JOB_DEFINITION,
  SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION,
  SEND_ORGANISATION_MEMBER_LEFT_EMAIL_JOB_DEFINITION,
  SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION,
  SEAL_DOCUMENT_JOB_DEFINITION,
  SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION,
  SEND_SIGNING_REJECTION_EMAILS_JOB_DEFINITION,
  SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION,
  SEND_DOCUMENT_CANCELLED_EMAILS_JOB_DEFINITION,
  SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION,
  BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION,
  BULK_SEND_TEMPLATE_JOB_DEFINITION,
  EXECUTE_WEBHOOK_JOB_DEFINITION,
  EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION,
  PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION,
  CLEANUP_RATE_LIMITS_JOB_DEFINITION,
  SEND_PENDING_EMAIL_JOB_DEFINITION,
  SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION,
  SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION,
  SEND_COMPLETED_EMAIL_JOB_DEFINITION,
  SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION,
  SEND_DOCUMENT_DELETED_EMAILS_JOB_DEFINITION,
  SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION,
  SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION,
  SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION,
] as const);

export const jobs = jobsClient;
