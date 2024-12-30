import { z } from 'zod';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';
import { updatePublicProfile } from '@documenso/lib/server-only/user/update-public-profile';
import { SubscriptionStatus } from '@documenso/prisma/client';

import { authenticatedProcedure } from '../trpc';

export const MAX_PROFILE_BIO_LENGTH = 256;

export const ZUpdatePublicProfileRequestSchema = z.object({
  bio: z
    .string()
    .max(MAX_PROFILE_BIO_LENGTH, {
      message: `Bio must be shorter than ${MAX_PROFILE_BIO_LENGTH + 1} characters`,
    })
    .optional(),
  enabled: z.boolean().optional(),
  url: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: 'Please enter a valid username.' })
    .regex(/^[a-z0-9-]+$/, {
      message: 'Username can only container alphanumeric characters and dashes.',
    })
    .optional(),
});
export const updatePublicProfileRoute = authenticatedProcedure
  .input(ZUpdatePublicProfileRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { url, bio, enabled } = input;

    if (IS_BILLING_ENABLED() && url !== undefined && url.length < 6) {
      const subscriptions = await getSubscriptionsByUserId({
        userId: ctx.user.id,
      }).then((subscriptions) =>
        subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE),
      );

      if (subscriptions.length === 0) {
        throw new AppError(AppErrorCode.PREMIUM_PROFILE_URL, {
          message: 'Only subscribers can have a username shorter than 6 characters',
        });
      }
    }

    const user = await updatePublicProfile({
      userId: ctx.user.id,
      data: {
        url,
        bio,
        enabled,
      },
    });

    return { success: true, url: user.url };
  });
