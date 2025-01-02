import { DocumentVisibility as DocumentVisibilityEnum } from '@prisma/client';
import { z } from 'zod';

export const ZDocumentVisibilitySchema = z.nativeEnum(DocumentVisibilityEnum);
export const DocumentVisibility = ZDocumentVisibilitySchema.enum;
export type TDocumentVisibility = z.infer<typeof ZDocumentVisibilitySchema>;
