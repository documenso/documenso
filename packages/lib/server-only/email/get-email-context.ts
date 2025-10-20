import { P, match } from 'ts-pattern';

import type { BrandingSettings } from '@documenso/email/providers/branding';
import { prisma } from '@documenso/prisma';
import type {
  DocumentMeta,
  EmailDomain,
  Organisation,
  OrganisationEmail,
  OrganisationType,
} from '@documenso/prisma/client';
import {
  EmailDomainStatus,
  type OrganisationClaim,
  type OrganisationGlobalSettings,
} from '@documenso/prisma/client';

import { DOCUMENSO_INTERNAL_EMAIL } from '../../constants/email';
import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  organisationGlobalSettingsToBranding,
  teamGlobalSettingsToBranding,
} from '../../utils/team-global-settings-to-branding';
import { extractDerivedTeamSettings } from '../../utils/teams';

type EmailMetaOption = Partial<Pick<DocumentMeta, 'emailId' | 'emailReplyTo' | 'language'>>;

type BaseGetEmailContextOptions = {
  /**
   * The source to extract the email context from.
   * - "Team" will use the team settings followed by the inherited organisation settings
   * - "Organisation" will use the organisation settings
   */
  source:
    | {
        type: 'team';
        teamId: number;
      }
    | {
        type: 'organisation';
        organisationId: string;
      };

  /**
   * The email type being sent, used to determine what email sender and language to use.
   * - INTERNAL: Emails to users, such as team invites, etc.
   * - RECIPIENT: Emails to recipients, such as document sent, document signed, etc.
   */
  emailType: 'INTERNAL' | 'RECIPIENT';
};

type InternalGetEmailContextOptions = BaseGetEmailContextOptions & {
  emailType: 'INTERNAL';
  meta?: EmailMetaOption | null;
};

type RecipientGetEmailContextOptions = BaseGetEmailContextOptions & {
  emailType: 'RECIPIENT';

  /**
   * Force meta options as a typesafe way to ensure developers don't forget to
   * pass it in if it is available.
   */
  meta: EmailMetaOption | null | undefined;
};

type GetEmailContextOptions = InternalGetEmailContextOptions | RecipientGetEmailContextOptions;

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
  emailLanguage: string;
};

export const getEmailContext = async (
  options: GetEmailContextOptions,
): Promise<EmailContextResponse> => {
  const { source, meta } = options;

  let emailContext: Omit<EmailContextResponse, 'senderEmail' | 'replyToEmail' | 'emailLanguage'>;

  if (source.type === 'organisation') {
    emailContext = await handleOrganisationEmailContext(source.organisationId);
  } else {
    emailContext = await handleTeamEmailContext(source.teamId);
  }

  const emailLanguage = meta?.language || emailContext.settings.documentLanguage;

  // Immediate return for internal emails.
  if (options.emailType === 'INTERNAL') {
    return {
      ...emailContext,
      senderEmail: DOCUMENSO_INTERNAL_EMAIL,
      replyToEmail: undefined,
      emailLanguage, // Not sure if we want to use this for internal emails.
    };
  }

  const replyToEmail = meta?.emailReplyTo || emailContext.settings.emailReplyTo || undefined;

  const senderEmailId = match(meta?.emailId)
    .with(P.string, (emailId) => emailId) // Explicit string means to use the provided email ID.
    .with(undefined, () => emailContext.settings.emailId) // Undefined means to use the inherited email ID.
    .with(null, () => null) // Explicit null means to use the Documenso email.
    .exhaustive();

  const foundSenderEmail = emailContext.allowedEmails.find((email) => email.id === senderEmailId);

  // Reset the emailId to null if not found.
  if (!foundSenderEmail) {
    emailContext.settings.emailId = null;
  }

  const senderEmail = foundSenderEmail
    ? {
        name: foundSenderEmail.emailName,
        address: foundSenderEmail.email,
      }
    : DOCUMENSO_INTERNAL_EMAIL;

  return {
    ...emailContext,
    senderEmail,
    replyToEmail,
    emailLanguage,
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

  const allowedEmails = getAllowedEmails(organisation);

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

  const allowedEmails = getAllowedEmails(organisation);

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

const getAllowedEmails = (
  organisation: Organisation & {
    emailDomains: (Pick<EmailDomain, 'status'> & { emails: OrganisationEmail[] })[];
    organisationClaim: OrganisationClaim;
  },
) => {
  if (!organisation.organisationClaim.flags.emailDomains) {
    return [];
  }

  return organisation.emailDomains
    .filter((emailDomain) => emailDomain.status === EmailDomainStatus.ACTIVE)
    .flatMap((emailDomain) => emailDomain.emails);
};
