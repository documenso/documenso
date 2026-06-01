import { prisma } from '@documenso/prisma';

import { SITE_SETTINGS_EMAIL_BLOCKLIST_ID, ZSiteSettingsEmailBlocklistSchema } from './schemas/email-blocklist';

/**
 * Returns the list of admin-configured email domains that should be treated as
 * disposable / blocked, in addition to the bundled `mailchecker` list.
 *
 * Returns an empty array when the setting has not been configured, is
 * disabled, or fails to parse — so a misconfigured setting can never block
 * signups outright.
 */
export const getEmailBlocklistDomains = async (): Promise<string[]> => {
  const setting = await prisma.siteSettings.findFirst({
    where: {
      id: SITE_SETTINGS_EMAIL_BLOCKLIST_ID,
    },
  });

  if (!setting || !setting.enabled) {
    return [];
  }

  const parsed = ZSiteSettingsEmailBlocklistSchema.safeParse(setting);

  if (!parsed.success) {
    return [];
  }

  return parsed.data.data.domains;
};
