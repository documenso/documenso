import { z } from 'zod';

export const ZDocumentVisibilitySchema = z.enum(['EVERYONE', 'ADMIN', 'MANAGERANDABOVE']);

export const DocumentVisibility = ZDocumentVisibilitySchema.Enum;

export type TDocumentVisibility = z.infer<typeof ZDocumentVisibilitySchema>;
