import type { BrandingSettings } from '@documenso/email/providers/branding';
import { prisma } from '@documenso/prisma';
import type { OrganisationEmail, OrganisationType } from '@documenso/prisma/client';
import {
  EmailDomainStatus,
  type OrganisationClaim,
  type OrganisationGlobalSettings,
} from '@documenso/prisma/client';

import { FROM_ADDRESS, FROM_NAME } from '../../constants/email';
import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  organisationGlobalSettingsToBranding,
  teamGlobalSettingsToBranding,
} from '../../utils/team-global-settings-to-branding';
import { extractDerivedTeamSettings } from '../../utils/teams';

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
  allowedEmails: OrganisationEmail[];
  branding: BrandingSettings;
  settings: Omit<OrganisationGlobalSettings, 'id'>;
  claims: OrganisationClaim;
  organisationType: OrganisationType;
  senderEmail: {
    name: string;
    address: string;
  };
  replyToEmail: string | undefined;
};

export const getEmailContext = async (
  options: GetEmailContextOptions,
): Promise<EmailContextResponse> => {
  const { source } = options;

  let emailContext: Omit<EmailContextResponse, 'senderEmail' | 'replyToEmail'>;

  if (source.type === 'organisation') {
    emailContext = await handleOrganisationEmailContext(source.organisationId);
  } else {
    emailContext = await handleTeamEmailContext(source.teamId);
  }

  const replyToEmail = emailContext.settings.emailReplyTo || undefined;

  const foundSenderEmail = emailContext.allowedEmails.find(
    (email) => email.id === emailContext.settings.emailId,
  );

  const senderEmail = foundSenderEmail
    ? {
        name: foundSenderEmail.emailName,
        address: foundSenderEmail.email,
      }
    : {
        name: FROM_NAME,
        address: FROM_ADDRESS,
      };

  return {
    ...emailContext,
    senderEmail,
    replyToEmail,
  };
};

const handleOrganisationEmailContext = async (organisationId: string) => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      id: organisationId,
    },
    include: {
      organisationClaim: true,
      organisationGlobalSettings: true,
      emailDomains: {
        omit: {
          privateKey: true,
        },
        include: {
          emails: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const claims = organisation.organisationClaim;

  const allowedEmails = organisation.emailDomains
    .filter(
      (emailDomain) =>
        emailDomain.status === EmailDomainStatus.ACTIVE &&
        organisation.organisationClaim.flags.emailDomains,
    )
    .flatMap((emailDomain) => emailDomain.emails);

  return {
    allowedEmails,
    branding: organisationGlobalSettingsToBranding(
      organisation.organisationGlobalSettings,
      organisation.id,
      claims.flags.hidePoweredBy ?? false,
    ),
    settings: organisation.organisationGlobalSettings,
    claims,
    organisationType: organisation.type,
  };
};

const handleTeamEmailContext = async (teamId: number) => {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
    },
    include: {
      teamGlobalSettings: true,
      organisation: {
        include: {
          organisationClaim: true,
          organisationGlobalSettings: true,
          emailDomains: {
            omit: {
              privateKey: true,
            },
            include: {
              emails: true,
            },
          },
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const organisation = team.organisation;
  const claims = organisation.organisationClaim;

  const allowedEmails = organisation.emailDomains
    .filter(
      (emailDomain) =>
        emailDomain.status === EmailDomainStatus.ACTIVE &&
        organisation.organisationClaim.flags.emailDomains,
    )
    .flatMap((emailDomain) => emailDomain.emails);

  const teamSettings = extractDerivedTeamSettings(
    organisation.organisationGlobalSettings,
    team.teamGlobalSettings,
  );

  return {
    allowedEmails,
    branding: teamGlobalSettingsToBranding(
      teamSettings,
      teamId,
      claims.flags.hidePoweredBy ?? false,
    ),
    settings: teamSettings,
    claims,
    organisationType: organisation.type,
  };
};
