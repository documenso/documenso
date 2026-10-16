import { z } from 'zod';

export const ZDeleteAdminTagRequestSchema = z.object({
  tagId: z.string(),
});

export const ZDeleteAdminTagResponseSchema = z.void();

export type TDeleteAdminTagRequest = z.infer<typeof ZDeleteAdminTagRequestSchema>;
export type TDeleteAdminTagResponse = z.infer<typeof ZDeleteAdminTagResponseSchema>;
