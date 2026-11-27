import AdminRuleSchema from '@documenso/prisma/generated/zod/modelSchema/AdminRuleSchema';
import AdminTagSchema from '@documenso/prisma/generated/zod/modelSchema/AdminTagSchema';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import { z } from 'zod';

export const ZGetAdminTagsRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user'),
    userId: z.number(),
  }),
  z.object({
    type: z.literal('organisation'),
    organisationId: z.string(),
  }),
]);

/**
 * Every tag on the user or organisation, newest first.
 */
export const ZGetAdminTagsResponseSchema = AdminTagSchema.extend({
  createdByUser: UserSchema.pick({
    id: true,
    name: true,
    email: true,
  }).nullable(),
  adminRule: AdminRuleSchema.pick({
    id: true,
    name: true,
  }).nullable(),
}).array();

export type TGetAdminTagsRequest = z.infer<typeof ZGetAdminTagsRequestSchema>;
export type TGetAdminTagsResponse = z.infer<typeof ZGetAdminTagsResponseSchema>;
