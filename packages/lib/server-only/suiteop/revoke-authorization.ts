import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type RevokeAuthorizationOptions = {
  teamId: number;
};

/**
 * Revokes SuiteOp integration for a team:
 * 1. Deletes all API tokens named "SuiteOp Integration" for the team
 * 2. Deletes all webhooks pointing to the SuiteOp hookdeck URL for the team
 * 3. Marks all SuiteOp authorizations for the team as revoked
 *
 * Authenticated via master key (same as claim-authorization).
 */
export const revokeAuthorization = async ({ teamId }: RevokeAuthorizationOptions) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Team ${teamId} not found`,
    });
  }

  // Delete all SuiteOp Integration API tokens for this team
  const deletedTokens = await prisma.apiToken.deleteMany({
    where: {
      teamId,
      name: 'SuiteOp Integration',
    },
  });

  // Delete all SuiteOp-related webhooks for this team (hookdeck URLs)
  const deletedWebhooks = await prisma.webhook.deleteMany({
    where: {
      teamId,
      webhookUrl: {
        contains: 'events.suiteop.com',
      },
    },
  });

  // Mark all authorizations for this team as revoked (clear plaintextToken)
  await prisma.suiteOpAuthorization.updateMany({
    where: {
      teamId,
    },
    data: {
      claimed: true,
      plaintextToken: '',
    },
  });

  return {
    deletedTokens: deletedTokens.count,
    deletedWebhooks: deletedWebhooks.count,
    teamId: team.id,
    teamName: team.name,
  };
};
