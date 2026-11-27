import AdminTagSchema from '@documenso/prisma/generated/zod/modelSchema/AdminTagSchema';
import { z } from 'zod';

import { ZAdminTagDataSchema } from './create-admin-tag.types';

export const ZUpdateAdminTagRequestSchema = z.object({
  tagId: z.string(),
  data: ZAdminTagDataSchema.partial(),
});

export const ZUpdateAdminTagResponseSchema = AdminTagSchema;

export type TUpdateAdminTagRequest = z.infer<typeof ZUpdateAdminTagRequestSchema>;
export type TUpdateAdminTagResponse = z.infer<typeof ZUpdateAdminTagResponseSchema>;
