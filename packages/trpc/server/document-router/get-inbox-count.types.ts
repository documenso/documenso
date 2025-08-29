// import type { OpenApiMeta } from 'trpc-to-openapi';
import { ReadStatus } from '@prisma/client';
import { z } from 'zod';

export const ZGetInboxCountRequestSchema = z
  .object({
    readStatus: z.nativeEnum(ReadStatus).optional(),
  })
  .optional();

export const ZGetInboxCountResponseSchema = z.object({
  count: z.number(),
});

export type TGetInboxCountResponse = z.infer<typeof ZGetInboxCountResponseSchema>;
