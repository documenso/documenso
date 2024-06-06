import { prisma } from '@documenso/prisma';
import type { Template, TemplateDirectLink } from '@documenso/prisma/client';
import {
  SubscriptionStatus,
  type TeamProfile,
  TemplateType,
  type UserProfile,
} from '@documenso/prisma/client';

import { IS_BILLING_ENABLED } from '../../constants/app';
import { STRIPE_COMMUNITY_PLAN_PRODUCT_ID } from '../../constants/billing';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { subscriptionsContainsActiveProductId } from '../../utils/billing';

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
  badge?: 'Premium' | 'EarlySupporter';
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
        Template: {
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
        // Subscriptions and _count are used to calculate the badges.
        Subscription: {
          where: {
            status: SubscriptionStatus.ACTIVE,
          },
        },
        _count: {
          select: {
            teamMembers: true,
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
    throw new AppError(AppErrorCode.INVALID_REQUEST, 'Profile URL is ambiguous');
  }

  if (user?.profile?.enabled) {
    let badge: BaseResponse['badge'] = undefined;

    if (user._count.teamMembers > 0) {
      badge = 'Premium';
    }

    const earlyAdopterProductId = STRIPE_COMMUNITY_PLAN_PRODUCT_ID();

    if (IS_BILLING_ENABLED() && earlyAdopterProductId) {
      const isEarlyAdopter = subscriptionsContainsActiveProductId(user.Subscription, [
        earlyAdopterProductId,
      ]);

      if (isEarlyAdopter) {
        badge = 'EarlySupporter';
      }
    }

    return {
      type: 'User',
      badge,
      profile: user.profile,
      url: profileUrl,
      name: user.name || '',
      templates: user.Template.filter(
        (template): template is PublicDirectLinkTemplate =>
          template.directLink?.enabled === true && template.type === TemplateType.PUBLIC,
      ),
    };
  }

  if (team?.profile?.enabled) {
    return {
      type: 'Team',
      badge: 'Premium',
      profile: team.profile,
      url: profileUrl,
      name: team.name || '',
      templates: team.templates.filter(
        (template): template is PublicDirectLinkTemplate =>
          template.directLink?.enabled === true && template.type === TemplateType.PUBLIC,
      ),
    };
  }

  throw new AppError(AppErrorCode.NOT_FOUND, 'Profile not found');
};
