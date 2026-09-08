import { getOrganisationAuthenticationPortalOptions } from '@documenso/auth/server/lib/utils/organisation-portal';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import {
  ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
  ORGANISATION_USER_ACCOUNT_TYPE,
} from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { ZOrganisationAccountLinkMetadataSchema } from '@documenso/lib/types/organisation';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, UserSecurityAuditLogType } from '@prisma/client';

export interface LinkOrganisationAccountOptions {
  token: string;
  requestMeta: RequestMetadata;
}

export const linkOrganisationAccount = async ({ token, requestMeta }: LinkOrganisationAccountOptions) => {
  if (!IS_BILLING_ENABLED()) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Billing is not enabled',
    });
  }

  // Read WITHOUT consuming: the token must stay retryable until membership
  // creation succeeds. Consumption happens atomically with the membership
  // creation below.
  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token,
      identifier: ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailVerified: true,
          disabled: true,
        },
      },
    },
  });

  if (!verificationToken) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Verification token not found, used or expired',
    });
  }

  if (verificationToken.completed) {
    throw new AppError('ALREADY_USED');
  }

  if (verificationToken.expires < new Date()) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Verification token not found, used or expired',
    });
  }

  const tokenMetadata = ZOrganisationAccountLinkMetadataSchema.safeParse(verificationToken.metadata);

  if (!tokenMetadata.success) {
    console.error('Invalid token metadata', tokenMetadata.error);

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Verification token not found, used or expired',
    });
  }

  const user = verificationToken.user;

  // Never link into (or activate membership for) a disabled account.
  if (user.disabled) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Account is disabled',
    });
  }

  // The confirmation is only valid for the email address it was sent to. An
  // email change between token issuance and confirmation invalidates it.
  if (user.email.toLowerCase() !== tokenMetadata.data.email.toLowerCase()) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Verification token not found, used or expired',
    });
  }

  const { clientOptions, organisation } = await getOrganisationAuthenticationPortalOptions({
    type: 'id',
    organisationId: tokenMetadata.data.organisationId,
  });

  const { providerAccountId } = tokenMetadata.data.oauthConfig;

  // Ownership conflict check: the provider subject must not already belong to
  // a different user. `createMany skipDuplicates` below would silently skip
  // in that case, which would confirm a link that never happened.
  const existingProviderAccount = await prisma.account.findFirst({
    where: {
      provider: clientOptions.id,
      providerAccountId,
    },
    select: {
      userId: true,
    },
  });

  if (existingProviderAccount && existingProviderAccount.userId !== user.id) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'This identity provider account is already linked to another user',
    });
  }

  const organisationMember = await prisma.organisationMember.findFirst({
    where: {
      userId: user.id,
      organisationId: tokenMetadata.data.organisationId,
    },
  });

  const isProviderAccountLinked = existingProviderAccount !== null;

  // Link the provider account idempotently. `createMany` + `skipDuplicates`
  // (unique on provider + providerAccountId) can never clobber an existing
  // row and is safe under concurrent confirmation attempts. The account row
  // is intentionally created WITHOUT access/ID tokens — they are never stored
  // in the token metadata, and the portal re-authenticates against the IdP on
  // every sign-in.
  if (!isProviderAccountLinked) {
    await prisma.$transaction(async (tx) => {
      const createdAccounts = await tx.account.createMany({
        data: [
          {
            type: ORGANISATION_USER_ACCOUNT_TYPE,
            provider: clientOptions.id,
            providerAccountId,
            userId: user.id,
          },
        ],
        skipDuplicates: true,
      });

      // A concurrent confirmation created the row first — nothing to do, and
      // the audit/verification side effects below belong to that request.
      if (createdAccounts.count === 0) {
        return;
      }

      // Log link event.
      await tx.userSecurityAuditLog.create({
        data: {
          userId: user.id,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
          type: UserSecurityAuditLogType.ORGANISATION_SSO_LINK,
        },
      });

      // If account already exists in an unverified state, remove the password to ensure
      // they cannot sign in using that method since we cannot confirm the password
      // was set by the user.
      if (!user.emailVerified) {
        await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            emailVerified: new Date(),
            password: null,
            // Todo: (RR7) Will need to update the "password" account after the migration.
          },
        });
      }
    });
  }

  // Create the membership and consume the verification token ATOMICALLY. The
  // `deleteMany` count check means a concurrent confirmation loses cleanly
  // (no double membership, no P2025 500), while any failure before commit
  // leaves the token intact and retryable.
  await prisma.$transaction(async (tx) => {
    const deletedTokens = await tx.verificationToken.deleteMany({
      where: {
        id: verificationToken.id,
      },
    });

    if (deletedTokens.count !== 1) {
      throw new AppError('ALREADY_USED');
    }

    if (organisationMember) {
      return;
    }

    const organisationGroupToUse = organisation.groups.find(
      (group) =>
        group.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
        group.organisationRole === organisation.organisationAuthenticationPortal.defaultOrganisationRole,
    );

    if (!organisationGroupToUse) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Organisation group not found',
      });
    }

    await tx.organisationMember.create({
      data: {
        id: generateDatabaseId('member'),
        userId: user.id,
        organisationId: tokenMetadata.data.organisationId,
        organisationGroupMembers: {
          create: {
            id: generateDatabaseId('group_member'),
            groupId: organisationGroupToUse.id,
          },
        },
      },
    });
  });

  // Best-effort notification AFTER the confirmation is committed — a failing
  // email job must not fail (or roll back) the confirmation itself.
  if (!organisationMember) {
    try {
      await jobs.triggerJob({
        name: 'send.organisation-member-joined.email',
        payload: {
          organisationId: tokenMetadata.data.organisationId,
          memberUserId: user.id,
        },
      });
    } catch (error) {
      // Todo: (RR7) Add logging.
      console.error('Failed to trigger organisation member joined email', error);
    }
  }
};
