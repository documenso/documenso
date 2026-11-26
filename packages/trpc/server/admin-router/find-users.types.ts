import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import { Role } from '@prisma/client';
import { z } from 'zod';

export const ZFindUsersRequestSchema = ZFindSearchParamsSchema.extend({
  role: z.literal(Role.ADMIN).optional(),
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
