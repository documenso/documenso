import type { Template, TemplateDirectLink } from '@prisma/client';
import { type TeamProfile, TemplateType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type GetPublicProfileByUrlOptions = {
  profileUrl: string;
};

type PublicDirectLinkTemplate = Template & {
  type: 'PUBLIC';
  directLink: TemplateDirectLink & {
    enabled: true;
  };
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
      templates: {
        where: {
          directLink: {
            enabled: true,
          },
          type: TemplateType.PUBLIC,
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
    profile: team.profile,
    url: profileUrl,
    avatarImageId: team.avatarImageId,
    name: team.name || '',
    templates: team.templates.filter(
      (template): template is PublicDirectLinkTemplate =>
        template.directLink?.enabled === true && template.type === TemplateType.PUBLIC,
    ),
  };
};
