import { JobClient } from './client/client';
import { SEND_CONFIRMATION_EMAIL_JOB_DEFINITION } from './definitions/send-confirmation-email';
import { SEND_SIGNING_EMAIL_JOB_DEFINITION } from './definitions/send-signing-email';

/**
 * The `as const` assertion is load bearing as it provides the correct level of type inference for
 * triggering jobs.
 */
export const jobsClient = new JobClient([
  SEND_SIGNING_EMAIL_JOB_DEFINITION,
  SEND_CONFIRMATION_EMAIL_JOB_DEFINITION,
] as const);
