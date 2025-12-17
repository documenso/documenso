import { prisma } from '@documenso/prisma';

import type { TSiteSettingSchema } from './schema';
import { ZSiteSettingSchema } from './schema';

export const getSiteSetting = async <
  T extends TSiteSettingSchema['id'],
  U = Extract<TSiteSettingSchema, { id: T }>,
>(options: {
  id: T;
}): Promise<U> => {
  const { id } = options;

  const setting = await prisma.siteSettings.findFirstOrThrow({
    where: {
      id,
    },
  });

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ZSiteSettingSchema.parse(setting) as U;
};
