import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import EmailSuppressionSchema from '@documenso/prisma/generated/zod/modelSchema/EmailSuppressionSchema';
import OrganisationSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import type { z } from 'zod';

export const ZFindEmailSuppressionsRequestSchema = ZFindSearchParamsSchema;

export const ZFindEmailSuppressionsResponseSchema = ZFindResultResponse.extend({
  data: EmailSuppressionSchema.pick({
    id: true,
    email: true,
    scope: true,
    source: true,
    reason: true,
    createdAt: true,
  })
    .extend({
      organisation: OrganisationSchema.pick({
        id: true,
        name: true,
      }).nullable(),
      team: TeamSchema.pick({
        id: true,
        name: true,
      }).nullable(),
      user: UserSchema.pick({
        id: true,
        name: true,
        email: true,
      }).nullable(),
    })
    .array(),
});

export type TFindEmailSuppressionsRequest = z.infer<typeof ZFindEmailSuppressionsRequestSchema>;
export type TFindEmailSuppressionsResponse = z.infer<typeof ZFindEmailSuppressionsResponseSchema>;
