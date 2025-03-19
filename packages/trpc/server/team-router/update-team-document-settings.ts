import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateTeamDocumentSettingsRequestSchema,
  ZUpdateTeamDocumentSettingsResponseSchema,
} from './update-team-document-settings.types';

/**
 * Private route.
 */
export const updateTeamDocumentSettingsRoute = authenticatedProcedure
  .input(ZUpdateTeamDocumentSettingsRequestSchema)
  .output(ZUpdateTeamDocumentSettingsResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { teamId, settings } = input;

    const {
      documentVisibility,
      documentLanguage,
      includeSenderDetails,
      includeSigningCertificate,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
    } = settings;

    const member = await prisma.teamMember.findFirst({
      where: {
        userId: user.id,
        teamId,
        role: {
          in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP.MANAGE_TEAM,
        },
      },
    });

    if (!member) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to update this team.',
      });
    }

    return await prisma.teamGlobalSettings.upsert({
      where: {
        teamId,
      },
      create: {
        teamId,
        documentVisibility,
        documentLanguage,
        includeSenderDetails,
        includeSigningCertificate,
        typedSignatureEnabled,
        uploadSignatureEnabled,
        drawSignatureEnabled,
      },
      update: {
        documentVisibility,
        documentLanguage,
        includeSenderDetails,
        includeSigningCertificate,
        typedSignatureEnabled,
        uploadSignatureEnabled,
        drawSignatureEnabled,
      },
    });
  });
