import { z } from 'zod';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_EMAIL_BLOCKLIST_ID = 'email.blocklist-domains';

/**
 * Normalises a single domain entry: trims whitespace, lowercases, strips
 * a leading "@" if present (so users can paste either "bad.com" or "@bad.com").
 */
const normaliseDomain = (value: string): string => value.trim().toLowerCase().replace(/^@/, '');

const ZBlocklistDomainsSchema = z
  .array(z.string())
  .transform((values) => Array.from(new Set(values.map(normaliseDomain).filter((value) => value.length > 0))));

export const ZSiteSettingsEmailBlocklistSchema = ZSiteSettingsBaseSchema.extend({
  id: z.literal(SITE_SETTINGS_EMAIL_BLOCKLIST_ID),
  data: z
    .object({
      domains: ZBlocklistDomainsSchema.default([]),
    })
    .optional()
    .default({
      domains: [],
    }),
});

export type TSiteSettingsEmailBlocklistSchema = z.infer<typeof ZSiteSettingsEmailBlocklistSchema>;
