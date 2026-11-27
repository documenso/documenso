import { z } from 'zod';

export const ZAdminTagTypeSchema = z.enum(['note', 'flagged_for_review']);

export type TAdminTagType = z.infer<typeof ZAdminTagTypeSchema>;
