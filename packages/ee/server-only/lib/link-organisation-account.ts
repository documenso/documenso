import { UserSecurityAuditLogType } from '@prisma/client';

import { getOrganisationAuthenticationPortalOptions } from '@documenso/auth/server/lib/utils/organisation-portal';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import {
  ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
  ORGANISATION_USER_ACCOUNT_TYPE,
} from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { addUserToOrganisation } from '@documenso/lib/server-only/organisation/accept-organisation-invitation';
import { ZOrganisationAccountLinkMetadataSchema } from '@documenso/lib/types/organisation';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

export interface LinkOrganisationAccountOptions {
  token: string;
  requestMeta: RequestMetadata;
}

export const linkOrganisationAccount = async ({
  token,
  requestMeta,
}: LinkOrganisationAccountOptions) => {
  if (!IS_BILLING_ENABLED()) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Billing is not enabled',
    });
  }

  // Delete the token since it contains unnecessary sensitive data.
  const verificationToken = await prisma.verificationToken.delete({
    where: {
      token,
      identifier: ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
    },
    include: {
      user: {
        select: {
          id: true,
          emailVerified: true,
          accounts: {
            select: {
              provider: true,
              providerAccountId: true,
            },
          },
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

  const tokenMetadata = ZOrganisationAccountLinkMetadataSchema.safeParse(
    verificationToken.metadata,
  );

  if (!tokenMetadata.success) {
    console.error('Invalid token metadata', tokenMetadata.error);

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Verification token not found, used or expired',
    });
  }

  const user = verificationToken.user;

  const { clientOptions, organisation } = await getOrganisationAuthenticationPortalOptions({
    type: 'id',
    organisationId: tokenMetadata.data.organisationId,
  });

  const organisationMember = await prisma.organisationMember.findFirst({
    where: {
      userId: user.id,
      organisationId: tokenMetadata.data.organisationId,
    },
  });

  const oauthConfig = tokenMetadata.data.oauthConfig;

  const userAlreadyLinked = user.accounts.find(
    (account) =>
      account.provider === clientOptions.id &&
      account.providerAccountId === oauthConfig.providerAccountId,
  );

  if (organisationMember && userAlreadyLinked) {
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // Link the user if not linked yet.
      if (!userAlreadyLinked) {
        await tx.account.create({
          data: {
            type: ORGANISATION_USER_ACCOUNT_TYPE,
            provider: clientOptions.id,
            providerAccountId: oauthConfig.providerAccountId,
            access_token: oauthConfig.accessToken,
            expires_at: oauthConfig.expiresAt,
            token_type: 'Bearer',
            id_token: oauthConfig.idToken,
            userId: user.id,
          },
        });

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
      }

      // Only add the user to the organisation if they are not already a member.
      if (!organisationMember) {
        await addUserToOrganisation({
          userId: user.id,
          organisationId: tokenMetadata.data.organisationId,
          organisationGroups: organisation.groups,
          organisationMemberRole:
            organisation.organisationAuthenticationPortal.defaultOrganisationRole,
        });
      }
    },
    { timeout: 30_000 },
  );
};
