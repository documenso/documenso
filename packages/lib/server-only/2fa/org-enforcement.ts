import { prisma } from '@documenso/prisma';
import type { Session, User } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { OrganisationTwoFactorEnforcementSettings } from '../../utils/two-factor';
import { computeOrganisationTwoFactorEnforcementStatus, isTwoFactorSatisfied } from '../../utils/two-factor';
import { getTwoFactorEnforcementStatus } from './get-two-factor-enforcement-status';

export type EnforcementUser = Pick<User, 'id' | 'twoFactorEnabled' | 'twoFactorGraceStartedAt'>;

export type EnforcementSession = Pick<Session, 'twoFactorVerified'> | null;

/**
 * The minimal data required to evaluate a user's 2FA enforcement status for a
 * single organisation.
 */
export type OrganisationTwoFactorScope = {
  organisationId: string;
  memberCreatedAt: Date;
  settings: OrganisationTwoFactorEnforcementSettings;
};

export type LoadOrganisationTwoFactorScopesOptions = {
  userId: number;

  /**
   * The organisations to load. `undefined` loads every organisation the user
   * is a member of (used for cross-organisation queries where the data scope
   * is "all my organisations").
   */
  organisationIds?: string[];
};

/**
 * Membership-qualified lookup of the per-organisation 2FA enforcement inputs.
 *
 * Organisations the user is not a member of are silently dropped — the
 * underlying handler's own authorization will reject those anyway, and
 * enforcement only applies to organisations the user can actually access.
 */
export const loadOrganisationTwoFactorScopes = async (
  options: LoadOrganisationTwoFactorScopesOptions,
): Promise<OrganisationTwoFactorScope[]> => {
  const { userId, organisationIds } = options;

  if (organisationIds && organisationIds.length === 0) {
    return [];
  }

  const organisations = await prisma.organisation.findMany({
    where: {
      ...(organisationIds ? { id: { in: organisationIds } } : {}),
      members: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      organisationGlobalSettings: {
        select: {
          twoFactorRequired: true,
          twoFactorGracePeriodDays: true,
          twoFactorEnforcedFrom: true,
        },
      },
      members: {
        where: {
          userId,
        },
        take: 1,
        select: {
          createdAt: true,
        },
      },
    },
  });

  return organisations.flatMap((organisation) => {
    const [member] = organisation.members;

    // Defensive: the membership filter above guarantees a member row exists.
    if (!member) {
      return [];
    }

    return [
      {
        organisationId: organisation.id,
        memberCreatedAt: member.createdAt,
        settings: organisation.organisationGlobalSettings,
      },
    ];
  });
};

const throwTwoFactorRequiredError = (): never => {
  throw new AppError(AppErrorCode.TWO_FACTOR_REQUIRED, {
    message: 'Two-factor authentication is required to access this resource.',
    userMessage: 'Two-factor authentication is required. Please enable it to continue.',
    statusCode: 403,
  });
};

export type AssertOrganisationScopesTwoFactorEnforcementOptions = {
  user: EnforcementUser;
  session: EnforcementSession;
  scopes: OrganisationTwoFactorScope[];
  now?: Date;
};

/**
 * Throws `AppError(TWO_FACTOR_REQUIRED)` when the user is blocked by ANY of
 * the provided organisation scopes.
 */
export const assertOrganisationScopesTwoFactorEnforcement = (
  options: AssertOrganisationScopesTwoFactorEnforcementOptions,
): void => {
  const { user, session, scopes, now = new Date() } = options;

  for (const scope of scopes) {
    const status = computeOrganisationTwoFactorEnforcementStatus({
      organisationSettings: scope.settings,
      memberCreatedAt: scope.memberCreatedAt,
      userTwoFactorEnabled: user.twoFactorEnabled,
      userTwoFactorGraceStartedAt: user.twoFactorGraceStartedAt,
      sessionTwoFactorVerified: session?.twoFactorVerified ?? false,
      now,
    });

    if (status.required && status.isBlocked) {
      throwTwoFactorRequiredError();
    }
  }
};

export type AssertTwoFactorEnforcementForSessionOptions = {
  user: EnforcementUser;
  session: EnforcementSession;

  /**
   * Organisations whose enforcement policy applies to this request.
   * `undefined` skips the organisation assert entirely (instance assert only).
   */
  organisationIds?: string[];
};

/**
 * Shared 2FA enforcement assert for session-authenticated endpoints outside
 * of tRPC (e.g. the Hono file/AI routes).
 *
 * - Satisfied users (enrolled + verified session) can never be blocked at
 *   either level, so they early-out without any queries.
 * - Instance enforcement blocks everything for the user.
 * - Organisation enforcement blocks when any of the provided organisations'
 *   policies block the user.
 */
export const assertTwoFactorEnforcementForSession = async (
  options: AssertTwoFactorEnforcementForSessionOptions,
): Promise<void> => {
  const { user, session, organisationIds } = options;

  // Cheap early-out: a satisfied user cannot be blocked by instance or
  // organisation enforcement (isBlocked requires !isSatisfied).
  if (
    isTwoFactorSatisfied({
      userTwoFactorEnabled: user.twoFactorEnabled,
      sessionTwoFactorVerified: session?.twoFactorVerified ?? false,
    })
  ) {
    return;
  }

  const instanceStatus = await getTwoFactorEnforcementStatus({ user, session });

  if (instanceStatus.required && instanceStatus.isBlocked) {
    throwTwoFactorRequiredError();
  }

  if (!organisationIds || organisationIds.length === 0) {
    return;
  }

  const scopes = await loadOrganisationTwoFactorScopes({
    userId: user.id,
    organisationIds,
  });

  assertOrganisationScopesTwoFactorEnforcement({ user, session, scopes });
};
