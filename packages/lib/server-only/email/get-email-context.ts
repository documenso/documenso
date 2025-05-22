import type { BrandingSettings } from '@documenso/email/providers/branding';
import { prisma } from '@documenso/prisma';
import type { OrganisationClaim, OrganisationGlobalSettings } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  organisationGlobalSettingsToBranding,
  teamGlobalSettingsToBranding,
} from '../../utils/team-global-settings-to-branding';
import { getTeamSettings } from '../team/get-team-settings';

type GetEmailContextOptions = {
  source:
    | {
        type: 'team';
        teamId: number;
      }
    | {
        type: 'organisation';
        organisationId: string;
      };
};

type EmailContextResponse = {
  branding: BrandingSettings;
  settings: Omit<OrganisationGlobalSettings, 'id'>;
  claims: OrganisationClaim;
};

export const getEmailContext = async (
  options: GetEmailContextOptions,
): Promise<EmailContextResponse> => {
  const { source } = options;

  const organisation = await prisma.organisation.findFirst({
    where:
      source.type === 'organisation'
        ? {
            id: source.organisationId,
          }
        : {
            teams: {
              some: {
                id: source.teamId,
              },
            },
          },
    include: {
      subscription: true,
      organisationClaim: true,
      organisationGlobalSettings: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const claims = organisation.organisationClaim;

  if (source.type === 'organisation') {
    return {
      branding: organisationGlobalSettingsToBranding(
        organisation.organisationGlobalSettings,
        organisation.id,
        claims.flags.hidePoweredBy ?? false,
      ),
      settings: organisation.organisationGlobalSettings,
      claims,
    };
  }

  const teamSettings = await getTeamSettings({
    teamId: source.teamId,
  });

  return {
    branding: teamGlobalSettingsToBranding(
      teamSettings,
      source.teamId,
      claims.flags.hidePoweredBy ?? false,
    ),
    settings: teamSettings,
    claims,
  };
};
