import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateTeamSettingsRequestSchema,
  ZUpdateTeamSettingsResponseSchema,
} from './update-team-settings.types';

export const updateTeamSettingsRoute = authenticatedProcedure
  .input(ZUpdateTeamSettingsRequestSchema)
  .output(ZUpdateTeamSettingsResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { teamId, data } = input;

    const {
      // Document related settings.
      documentVisibility,
      documentLanguage,
      includeSenderDetails,
      includeSigningCertificate,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
      // Branding related settings.
      // brandingEnabled,
      // brandingLogo,
      // brandingUrl,
      // brandingCompanyDetails,
    } = data;

    if (Object.values(data).length === 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'No settings to update',
      });
    }

    // Signatures will only be inherited if all are NULL.
    if (
      typedSignatureEnabled === false &&
      uploadSignatureEnabled === false &&
      drawSignatureEnabled === false
    ) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'At least one signature type must be enabled',
      });
    }

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery(teamId, user.id, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to update this team.',
      });
    }

    await prisma.team.update({
      where: {
        id: teamId,
      },
      data: {
        teamGlobalSettings: {
          update: {
            // Document related settings.
            documentVisibility,
            documentLanguage,
            includeSenderDetails,
            includeSigningCertificate,
            typedSignatureEnabled,
            uploadSignatureEnabled,
            drawSignatureEnabled,

            // Branding related settings.
            // brandingEnabled,
            // brandingLogo,
            // brandingUrl,
            // brandingCompanyDetails,
          },
        },
      },
    });
  });
