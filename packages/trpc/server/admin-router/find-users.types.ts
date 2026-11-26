import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import RoleSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/RoleSchema';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import { z } from 'zod';

export const ZFindUsersRequestSchema = ZFindSearchParamsSchema.extend({
  role: RoleSchema.optional(),
});

export const ZFindUsersResponseSchema = ZFindResultResponse.extend({
  data: UserSchema.pick({
    id: true,
    name: true,
    email: true,
    roles: true,
  })
    .extend({
      documentCount: z.number(),
    })
    .array(),
});

export type TFindUsersRequest = z.infer<typeof ZFindUsersRequestSchema>;
export type TFindUsersResponse = z.infer<typeof ZFindUsersResponseSchema>;
