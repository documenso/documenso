import { z } from 'zod';

import { DocumentVisibility as DocumentVisibilityEnum } from '@documenso/prisma/client';

export const ZDocumentVisibilitySchema = z.nativeEnum(DocumentVisibilityEnum);
export const DocumentVisibility = ZDocumentVisibilitySchema.enum;
export type TDocumentVisibility = z.infer<typeof ZDocumentVisibilitySchema>;
