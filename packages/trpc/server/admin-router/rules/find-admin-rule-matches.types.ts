import { ZAdminRuleModeSchema, ZAdminRuleTriggerSchema } from '@documenso/lib/types/admin-rules';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import AdminRuleMatchSchema from '@documenso/prisma/generated/zod/modelSchema/AdminRuleMatchSchema';
import AdminRuleSchema from '@documenso/prisma/generated/zod/modelSchema/AdminRuleSchema';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import { z } from 'zod';

export const ZAdminRuleMatchPeriodSchema = z.enum(['24h', '7d', '30d']);

export type TAdminRuleMatchPeriod = z.infer<typeof ZAdminRuleMatchPeriodSchema>;

export const ZFindAdminRuleMatchesRequestSchema = ZFindSearchParamsSchema.extend({
  ruleId: z.string().optional(),
  trigger: ZAdminRuleTriggerSchema.optional(),
  mode: ZAdminRuleModeSchema.optional(),
  period: ZAdminRuleMatchPeriodSchema.optional(),
  /**
   * Only matches where an enforced rule blocked the event.
   */
  blockedOnly: z.boolean().optional(),
});

/**
 * The event snapshot is left out on purpose: it holds personal data and document content that the
 * list never shows.
 */
export const ZFindAdminRuleMatchesResponseSchema = ZFindResultResponse.extend({
  data: AdminRuleMatchSchema.pick({
    id: true,
    createdAt: true,
    mode: true,
    trigger: true,
    actionsRun: true,
  })
    .extend({
      rule: AdminRuleSchema.pick({
        id: true,
        name: true,
      }),
      actorUser: UserSchema.pick({
        id: true,
        email: true,
        name: true,
      }).nullable(),
    })
    .array(),
});

export type TFindAdminRuleMatchesRequest = z.infer<typeof ZFindAdminRuleMatchesRequestSchema>;
export type TFindAdminRuleMatchesResponse = z.infer<typeof ZFindAdminRuleMatchesResponseSchema>;
