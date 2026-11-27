import { ZAdminTagTypeSchema } from '@documenso/lib/types/admin-tags';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import AdminRuleSchema from '@documenso/prisma/generated/zod/modelSchema/AdminRuleSchema';
import AdminTagSchema from '@documenso/prisma/generated/zod/modelSchema/AdminTagSchema';
import OrganisationSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import { z } from 'zod';

export const ZAdminTagSubjectTypeSchema = z.enum(['user', 'organisation']);

/**
 * A tag added by an admin or by a rule. Tags whose admin and rule have both since been deleted match
 * neither.
 */
export const ZAdminTagSourceSchema = z.enum(['admin', 'rule']);

export const ZAdminTagOrderByColumnSchema = z.enum(['createdAt', 'updatedAt']);

export const ZAdminTagOrderByDirectionSchema = z.enum(['asc', 'desc']);

export const ZFindAdminTagsRequestSchema = ZFindSearchParamsSchema.extend({
  type: ZAdminTagTypeSchema.optional(),
  subjectType: ZAdminTagSubjectTypeSchema.optional(),
  source: ZAdminTagSourceSchema.optional(),
  orderByColumn: ZAdminTagOrderByColumnSchema.default('createdAt'),
  orderByDirection: ZAdminTagOrderByDirectionSchema.default('desc'),
});

export const ZFindAdminTagsResponseSchema = ZFindResultResponse.extend({
  data: AdminTagSchema.extend({
    user: UserSchema.pick({
      id: true,
      name: true,
      email: true,
    }).nullable(),
    organisation: OrganisationSchema.pick({
      id: true,
      name: true,
      url: true,
    }).nullable(),
    createdByUser: UserSchema.pick({
      id: true,
      name: true,
      email: true,
    }).nullable(),
    adminRule: AdminRuleSchema.pick({
      id: true,
      name: true,
    }).nullable(),
  }).array(),
});

export type TAdminTagSubjectType = z.infer<typeof ZAdminTagSubjectTypeSchema>;
export type TAdminTagSource = z.infer<typeof ZAdminTagSourceSchema>;
export type TAdminTagOrderByColumn = z.infer<typeof ZAdminTagOrderByColumnSchema>;
export type TFindAdminTagsRequest = z.infer<typeof ZFindAdminTagsRequestSchema>;
export type TFindAdminTagsResponse = z.infer<typeof ZFindAdminTagsResponseSchema>;
