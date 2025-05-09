import { z } from 'zod';

export const FolderType = {
  DOCUMENT: 'DOCUMENT',
  TEMPLATE: 'TEMPLATE',
  CHAT: 'CHAT',
} as const;

export const ZFolderTypeSchema = z.enum([
  FolderType.DOCUMENT,
  FolderType.TEMPLATE,
  FolderType.CHAT,
]);
export type TFolderType = z.infer<typeof ZFolderTypeSchema>;
