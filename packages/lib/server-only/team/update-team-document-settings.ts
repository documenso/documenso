import type { DocumentVisibility } from '@prisma/client';
import { TeamMemberRole } from '@prisma/client';
import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamGlobalSettingsSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamGlobalSettingsSchema';

import type { SupportedLanguageCodes } from '../../constants/i18n';

export type UpdateTeamDocumentSettingsOptions = {
  userId: number;
  teamId: number;

  settings: {
    documentVisibility: DocumentVisibility;
    documentLanguage: SupportedLanguageCodes;
    includeSenderDetails: boolean;
    typedSignatureEnabled: boolean;
    includeSigningCertificate: boolean;
  };
};

export const ZUpdateTeamDocumentSettingsResponseSchema = TeamGlobalSettingsSchema;

export type TUpdateTeamDocumentSettingsResponse = z.infer<
  typeof ZUpdateTeamDocumentSettingsResponseSchema
>;

export const updateTeamDocumentSettings = async ({
  userId,
  teamId,
  settings,
}: UpdateTeamDocumentSettingsOptions): Promise<TUpdateTeamDocumentSettingsResponse> => {
  const {
    documentVisibility,
    documentLanguage,
    includeSenderDetails,
    includeSigningCertificate,
    typedSignatureEnabled,
  } = settings;

  const member = await prisma.teamMember.findFirst({
    where: {
      userId,
      teamId,
    },
  });

  if (!member || member.role !== TeamMemberRole.ADMIN) {
    throw new Error('You do not have permission to update this team.');
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
      typedSignatureEnabled,
      includeSigningCertificate,
    },
    update: {
      documentVisibility,
      documentLanguage,
      includeSenderDetails,
      typedSignatureEnabled,
      includeSigningCertificate,
    },
  });
};
