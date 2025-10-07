import { upsertSiteSetting } from '@documenso/lib/server-only/site-settings/upsert-site-setting';

import { adminProcedure } from '../trpc';
import {
  ZUpdateSiteSettingRequestSchema,
  ZUpdateSiteSettingResponseSchema,
} from './update-site-setting.types';

export const updateSiteSettingRoute = adminProcedure
  .input(ZUpdateSiteSettingRequestSchema)
  .output(ZUpdateSiteSettingResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { id, enabled, data } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    await upsertSiteSetting({
      id,
      enabled,
      data,
      userId: ctx.user.id,
    });
  });
