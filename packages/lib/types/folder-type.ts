import { z } from 'zod';

export const FolderType = {
  DOCUMENT: 'DOCUMENT',
  TEMPLATE: 'TEMPLATE',
} as const;

export const ZFolderTypeSchema = z.enum([FolderType.DOCUMENT, FolderType.TEMPLATE]);
export type TFolderType = z.infer<typeof ZFolderTypeSchema>;
