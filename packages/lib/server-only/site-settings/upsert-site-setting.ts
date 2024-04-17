import { prisma } from '@documenso/prisma';

import type { TSiteSettingSchema } from './schema';

export type UpsertSiteSettingOptions = TSiteSettingSchema & {
  userId: number;
};

export const upsertSiteSetting = async ({
  id,
  enabled,
  data,
  userId,
}: UpsertSiteSettingOptions) => {
  return await prisma.siteSettings.upsert({
    where: {
      id,
    },
    create: {
      id,
      enabled,
      data,
      lastModifiedByUserId: userId,
      lastModifiedAt: new Date(),
    },
    update: {
      enabled,
      data,
      lastModifiedByUserId: userId,
      lastModifiedAt: new Date(),
    },
  });
};
