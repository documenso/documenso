import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import {
  recipientEmailRateLimit1d,
  recipientEmailRateLimit5m,
} from '@documenso/lib/server-only/rate-limit/rate-limits';

type AssertOrgEmailSendAllowedOptions = {
  organisationId: string;
};

type Result = { allowed: true } | { allowed: false; reason: '5m' | '1d'; resetsAt: Date };

/**
 * TEMPORARY: rate-limit unsolicited recipient emails per organisation.
 *
 * Two layered windows: 100/5m and 1000/1d, both keyed to org id. Returns a
 * result object so callers can choose to silently drop (job path) or throw
 * (sync path).
 *
 * Remove this helper and all callers when the comprehensive abuse-prevention
 * design lands. See .agents/plans/sharp-gold-wave-email-abuse-prevention.md
 */
export const assertOrgEmailSendAllowed = async (options: AssertOrgEmailSendAllowedOptions): Promise<Result> => {
  // Self-hosted instances are not behind the SES cap.
  if (!IS_BILLING_ENABLED()) {
    return { allowed: true };
  }

  const ip = `org:${options.organisationId}`;

  const fiveMinResult = await recipientEmailRateLimit5m.check({ ip });
  if (fiveMinResult.isLimited) {
    return { allowed: false, reason: '5m', resetsAt: fiveMinResult.reset };
  }

  const dailyResult = await recipientEmailRateLimit1d.check({ ip });
  if (dailyResult.isLimited) {
    return { allowed: false, reason: '1d', resetsAt: dailyResult.reset };
  }

  return { allowed: true };
};
