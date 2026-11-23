import AdminRuleSchema from '@documenso/prisma/generated/zod/modelSchema/AdminRuleSchema';
import OrganisationSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';
import { z } from 'zod';

export const ZGetAdminRulesRequestSchema = z.void();

export const ZAdminRuleExemptOrganisationSchema = OrganisationSchema.pick({
  id: true,
  name: true,
  url: true,
});

export const ZAdminRuleListItemSchema = AdminRuleSchema.extend({
  matchCountLast7Days: z.number(),
  lastMatchedAt: z.date().nullable(),
  /**
   * The organisations behind `exemptOrganisationIds`. Ids for organisations that no longer exist
   * are not included.
   */
  exemptOrganisations: ZAdminRuleExemptOrganisationSchema.array(),
});

/**
 * Every rule in priority order. Not paginated, because reordering works on the full list.
 */
export const ZGetAdminRulesResponseSchema = ZAdminRuleListItemSchema.array();

export type TGetAdminRulesResponse = z.infer<typeof ZGetAdminRulesResponseSchema>;
export type TAdminRuleListItem = z.infer<typeof ZAdminRuleListItemSchema>;
