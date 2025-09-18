import type { Envelope, TemplateDirectLink } from '@prisma/client';
import { EnvelopeType, type TeamProfile, TemplateType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type GetPublicProfileByUrlOptions = {
  profileUrl: string;
};

type PublicDirectLinkTemplate = Pick<Envelope, 'id' | 'publicTitle' | 'publicDescription'> & {
  directLink: TemplateDirectLink;
};

type GetPublicProfileByUrlResponse = {
  url: string;
  name: string;
  avatarImageId?: string | null;
  badge?: {
    type: 'Premium' | 'EarlySupporter';
    since: Date;
  };
  templates: PublicDirectLinkTemplate[];
  profile: TeamProfile;
};

/**
 * Get the user or team public profile by URL.
 */
export const getPublicProfileByUrl = async ({
  profileUrl,
}: GetPublicProfileByUrlOptions): Promise<GetPublicProfileByUrlResponse> => {
  const team = await prisma.team.findFirst({
    where: {
      url: profileUrl,
      profile: {
        enabled: true,
      },
    },
    include: {
      profile: true,
      envelopes: {
        where: {
          type: EnvelopeType.TEMPLATE,
          templateType: TemplateType.PUBLIC,
          directLink: {
            enabled: true,
          },
        },
        include: {
          directLink: true,
        },
      },
    },
  });

  if (!team?.profile?.enabled) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Profile not found',
    });
  }

  return {
    badge: {
      type: 'Premium',
      since: team.createdAt,
    },
    profile: {
      teamId: team.profile.teamId,
      id: team.profile.id,
      enabled: team.profile.enabled,
      bio: team.profile.bio,
    },
    url: profileUrl,
    avatarImageId: team.avatarImageId,
    name: team.name || '',
    templates: team.envelopes.map((template) => {
      const directLink = template.directLink;

      if (!directLink || !directLink.enabled || template.templateType !== TemplateType.PUBLIC) {
        throw new Error('Not possible');
      }

      return {
        id: template.id,
        publicTitle: template.publicTitle,
        publicDescription: template.publicDescription,
        directLink,
      };
    }),
  };
};
