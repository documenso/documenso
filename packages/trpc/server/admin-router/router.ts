import { TRPCError } from '@trpc/server';

import { updateUser } from '@documenso/lib/server-only/admin/update-user';
import { upsertSiteSetting } from '@documenso/lib/server-only/site-settings/upsert-site-setting';

import { adminProcedure, router } from '../trpc';
import { ZUpdateProfileMutationByAdminSchema, ZUpdateSiteSettingMutationSchema } from './schema';

export const adminRouter = router({
  updateUser: adminProcedure
    .input(ZUpdateProfileMutationByAdminSchema)
    .mutation(async ({ input }) => {
      const { id, name, email, roles } = input;

      try {
        return await updateUser({ id, name, email, roles });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to retrieve the specified account. Please try again.',
        });
      }
    }),

  updateSiteSetting: adminProcedure
    .input(ZUpdateSiteSettingMutationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, enabled, data } = input;

        return await upsertSiteSetting({
          id,
          enabled,
          data,
          userId: ctx.user.id,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to update the site setting provided.',
        });
      }
    }),
});
