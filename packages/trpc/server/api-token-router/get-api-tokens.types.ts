import { z } from 'zod';

import ApiTokenSchema from '@documenso/prisma/generated/zod/modelSchema/ApiTokenSchema';

export const ZGetApiTokensRequestSchema = z.void();

export const ZGetApiTokensResponseSchema = z.array(
  ApiTokenSchema.pick({
    id: true,
    name: true,
    createdAt: true,
    expires: true,
  }),
);

export type TGetApiTokensResponse = z.infer<typeof ZGetApiTokensResponseSchema>;
