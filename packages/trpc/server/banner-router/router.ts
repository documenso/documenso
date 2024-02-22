import { TRPCError } from '@trpc/server';

import { upsertBanner } from '@documenso/lib/server-only/banner/upsert-banner';

import { adminProcedure, router } from '../trpc';
import { ZCreateBannerByAdminSchema } from './schema';

export const bannerRouter = router({
  updateBanner: adminProcedure
    .input(ZCreateBannerByAdminSchema)
    .mutation(async ({ input, ctx }) => {
      const { show, text } = input;

      try {
        return await upsertBanner({
          userId: ctx.user.id,
          show,
          text,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to update your banner. Please try again.',
        });
      }
    }),
});
