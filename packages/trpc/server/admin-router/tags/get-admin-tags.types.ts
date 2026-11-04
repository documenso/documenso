import AdminRuleSchema from '@documenso/prisma/generated/zod/modelSchema/AdminRuleSchema';
import AdminTagSchema from '@documenso/prisma/generated/zod/modelSchema/AdminTagSchema';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import { z } from 'zod';

export const ZGetAdminTagsRequestSchema = z.object({
  userId: z.number(),
});

/**
 * Every tag on the user, newest first.
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
