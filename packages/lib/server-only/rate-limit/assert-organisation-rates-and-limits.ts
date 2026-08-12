import { prisma } from '@documenso/prisma';
import type { OrganisationClaim } from '@prisma/client';
import { match } from 'ts-pattern';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { ZRateLimitArraySchema } from '../../types/subscription';
import { checkMonthlyQuota } from './check-monthly-quota';
import { checkOrganisationRateLimits } from './check-organisation-rate-limits';
import type { LimitCounter } from './types';

type AssertOrganisationRatesAndLimitsOptions = {
  organisationId: string;

  /**
   * The organisation claim to use. If not provided, it will be loaded from the database.
   */
  organisationClaim?: OrganisationClaim;

  /**
   * Units to reserve. Must be >= 0.
   */
  count: number;

  /**
   * The type of rate limit to assert.
   */
  type: LimitCounter;
};

export const assertOrganisationRatesAndLimits = async (
  opts: AssertOrganisationRatesAndLimitsOptions,
): Promise<void> => {
  if (process.env.DANGEROUS_BYPASS_RATE_LIMITS === 'true') {
    return;
  }

  let { organisationClaim, count } = opts;

  // Nothing to reserve, treat as a no-op.
  if (count === 0) {
    return;
  }

  if (count < 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Count must be greater than or equal to 0',
    });
  }

  if (!organisationClaim) {
    const organisation = await prisma.organisation.findUniqueOrThrow({
      where: { id: opts.organisationId },
      select: {
        id: true,
        organisationClaim: true,
      },
    });

    organisationClaim = organisation.organisationClaim;
  }

  const { rateLimits, quota } = match(opts.type)
    .with('api', () => ({
      rateLimits: ZRateLimitArraySchema.parse(organisationClaim.apiRateLimits),
      quota: organisationClaim.apiQuota,
    }))
    .with('document', () => ({
      rateLimits: ZRateLimitArraySchema.parse(organisationClaim.documentRateLimits),
      quota: organisationClaim.documentQuota,
    }))
    .with('email', () => ({
      rateLimits: ZRateLimitArraySchema.parse(organisationClaim.emailRateLimits),
      quota: organisationClaim.emailQuota,
    }))
    .exhaustive();

  await checkOrganisationRateLimits({
    organisationId: opts.organisationId,
    counter: opts.type,
    entries: rateLimits,
    count,
  });

  await checkMonthlyQuota({
    organisationId: opts.organisationId,
    counter: opts.type,
    quota,
    count,
  });
};
