import { prisma } from '@documenso/prisma';
import type { Session, User } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { OrganisationTwoFactorEnforcementSettings } from '../../utils/two-factor';
import { computeOrganisationTwoFactorEnforcementStatus, isTwoFactorSatisfied } from '../../utils/two-factor';
import { getTwoFactorEnforcementStatus } from './get-two-factor-enforcement-status';

export type EnforcementUser = Pick<User, 'id' | 'twoFactorEnabled' | 'twoFactorGraceStartedAt'>;

export type EnforcementSession = Pick<Session, 'twoFactorVerified'> | null;

export type OrganisationTwoFactorScope = {
  organisationId: string;
  memberCreatedAt: Date;
  settings: OrganisationTwoFactorEnforcementSettings;
};

export type LoadOrganisationTwoFactorScopesOptions = {
  userId: number;
  /**
   * `undefined` loads every organisation the user is a member of.
   */
  organisationIds?: string[];
};

/**
 * Organisations the user is not a member of are silently dropped; the handler's
 * own authorization rejects those anyway.
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
   * `undefined` skips the organisation assert entirely (instance assert only).
   */
  organisationIds?: string[];
};

export const assertTwoFactorEnforcementForSession = async (
  options: AssertTwoFactorEnforcementForSessionOptions,
): Promise<void> => {
  const { user, session, organisationIds } = options;

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
