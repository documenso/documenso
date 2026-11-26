import { z } from 'zod';

/**
 * Admin tags attach a piece of information to a user or organisation, either placed by an admin
 * by hand or by an admin rule. The type is a plain string column so new types need no migration.
 */
export const ZAdminTagTypeSchema = z.enum(['flagged_for_review']);

export type TAdminTagType = z.infer<typeof ZAdminTagTypeSchema>;
