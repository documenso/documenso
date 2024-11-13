import { prisma } from '@documenso/prisma';
import type { DocumentVisibility } from '@documenso/prisma/client';
import { TeamMemberRole } from '@documenso/prisma/client';

import type { SupportedLanguageCodes } from '../../constants/i18n';

export type UpdateTeamDocumentSettingsOptions = {
  userId: number;
  teamId: number;

  settings: {
    documentVisibility: DocumentVisibility;
    documentLanguage: SupportedLanguageCodes;
    includeSenderDetails: boolean;
  };
};

export const updateTeamDocumentSettings = async ({
  userId,
  teamId,
  settings,
}: UpdateTeamDocumentSettingsOptions) => {
  const { documentVisibility, documentLanguage, includeSenderDetails } = settings;

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
    },
    update: {
      documentVisibility,
      documentLanguage,
      includeSenderDetails,
    },
  });
};
