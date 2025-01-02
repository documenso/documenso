import type { Template, TemplateDirectLink } from '@prisma/client';
import {
  SubscriptionStatus,
  type TeamProfile,
  TemplateType,
  type UserProfile,
} from '@prisma/client';

import { getCommunityPlanPriceIds } from '@documenso/ee/server-only/stripe/get-community-plan-prices';
import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../constants/app';
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

type BaseResponse = {
  url: string;
  name: string;
  avatarImageId?: string | null;
  badge?: {
    type: 'Premium' | 'EarlySupporter';
    since: Date;
  };
  templates: PublicDirectLinkTemplate[];
};

type GetPublicProfileByUrlResponse = BaseResponse &
  (
    | {
        type: 'User';
        profile: UserProfile;
      }
    | {
        type: 'Team';
        profile: TeamProfile;
      }
  );

/**
 * Get the user or team public profile by URL.
 */
export const getPublicProfileByUrl = async ({
  profileUrl,
}: GetPublicProfileByUrlOptions): Promise<GetPublicProfileByUrlResponse> => {
  const [user, team] = await Promise.all([
    prisma.user.findFirst({
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
        // Subscriptions and teamMembers are used to calculate the badges.
        subscriptions: {
          where: {
            status: SubscriptionStatus.ACTIVE,
          },
        },
        teamMembers: {
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    }),
    prisma.team.findFirst({
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
    }),
  ]);

  // Log as critical error.
  if (user?.profile && team?.profile) {
    console.error('Profile URL is ambiguous', { profileUrl, userId: user.id, teamId: team.id });
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Profile URL is ambiguous',
    });
  }

  if (user?.profile?.enabled) {
    let badge: BaseResponse['badge'] = undefined;

    if (user.teamMembers[0]) {
      badge = {
        type: 'Premium',
        since: user.teamMembers[0]['createdAt'],
      };
    }

    if (IS_BILLING_ENABLED()) {
      const earlyAdopterPriceIds = await getCommunityPlanPriceIds();

      const activeEarlyAdopterSub = user.subscriptions.find(
        (subscription) =>
          subscription.status === SubscriptionStatus.ACTIVE &&
          earlyAdopterPriceIds.includes(subscription.priceId),
      );

      if (activeEarlyAdopterSub) {
        badge = {
          type: 'EarlySupporter',
          since: activeEarlyAdopterSub.createdAt,
        };
      }
    }

    return {
      type: 'User',
      badge,
      profile: user.profile,
      url: profileUrl,
      avatarImageId: user.avatarImageId,
      name: user.name || '',
      templates: user.templates.filter(
        (template): template is PublicDirectLinkTemplate =>
          template.directLink?.enabled === true && template.type === TemplateType.PUBLIC,
      ),
    };
  }

  if (team?.profile?.enabled) {
    return {
      type: 'Team',
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
  }

  throw new AppError(AppErrorCode.NOT_FOUND, {
    message: 'Profile not found',
  });
};
