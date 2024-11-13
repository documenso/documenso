import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

export type UpdateTeamBrandingSettingsOptions = {
  userId: number;
  teamId: number;

  settings: {
    brandingEnabled: boolean;
    brandingLogo: string;
    brandingUrl: string;
    brandingCompanyDetails: string;
  };
};

export const updateTeamBrandingSettings = async ({
  userId,
  teamId,
  settings,
}: UpdateTeamBrandingSettingsOptions) => {
  const { brandingEnabled, brandingLogo, brandingUrl, brandingCompanyDetails } = settings;

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
      brandingEnabled,
      brandingLogo,
      brandingUrl,
      brandingCompanyDetails,
    },
    update: {
      brandingEnabled,
      brandingLogo,
      brandingUrl,
      brandingCompanyDetails,
    },
  });
};
