import { z } from 'zod';

import { ZFolderTypeSchema } from '@documenso/lib/types/folder-type';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { DocumentVisibility } from '@documenso/prisma/generated/types';
import FolderSchema from '@documenso/prisma/generated/zod/modelSchema/FolderSchema';

export const ZFolderSchema = FolderSchema.pick({
  id: true,
  name: true,
  userId: true,
  teamId: true,
  parentId: true,
  pinned: true,
  createdAt: true,
  updatedAt: true,
  visibility: true,
  type: true,
});

export type TFolder = z.infer<typeof ZFolderSchema>;

const ZFolderCountSchema = z.object({
  documents: z.number(),
  templates: z.number(),
  subfolders: z.number(),
});

const ZSubfolderSchema = ZFolderSchema.extend({
  subfolders: z.array(z.any()),
  _count: ZFolderCountSchema,
});

export const ZFolderWithSubfoldersSchema = ZFolderSchema.extend({
  subfolders: z.array(ZSubfolderSchema),
  _count: ZFolderCountSchema,
});

export type TFolderWithSubfolders = z.infer<typeof ZFolderWithSubfoldersSchema>;

const ZFolderParentIdSchema = z
  .string()
  .describe(
    'The folder ID to place this folder within. Leave empty to place folder at the root level.',
  );

export const ZCreateFolderRequestSchema = z.object({
  name: z.string(),
  parentId: ZFolderParentIdSchema.optional(),
  type: ZFolderTypeSchema.optional(),
});

export const ZCreateFolderResponseSchema = ZFolderSchema;

export const ZUpdateFolderRequestSchema = z.object({
  folderId: z.string().describe('The ID of the folder to update'),
  data: z.object({
    name: z.string().optional().describe('The name of the folder'),
    parentId: ZFolderParentIdSchema.optional().nullable(),
    visibility: z
      .nativeEnum(DocumentVisibility)
      .optional()
      .describe('The visibility of the folder'),
    pinned: z.boolean().optional().describe('Whether the folder should be pinned'),
  }),
});

export type TUpdateFolderRequestSchema = z.infer<typeof ZUpdateFolderRequestSchema>;

export const ZUpdateFolderResponseSchema = ZFolderSchema;

export const ZDeleteFolderRequestSchema = z.object({
  folderId: z.string(),
});

export const ZGetFoldersSchema = z.object({
  parentId: z.string().nullable().optional(),
  type: ZFolderTypeSchema.optional(),
});

export const ZGetFoldersResponseSchema = z.object({
  folders: z.array(ZFolderWithSubfoldersSchema),
  breadcrumbs: z.array(ZFolderSchema),
  type: ZFolderTypeSchema.optional(),
});

export type TGetFoldersResponse = z.infer<typeof ZGetFoldersResponseSchema>;

export const ZFindFoldersRequestSchema = ZFindSearchParamsSchema.extend({
  parentId: z.string().optional().describe('Filter folders by the parent folder ID'),
  type: ZFolderTypeSchema.optional().describe('Filter folders by the folder type'),
});

export const ZFindFoldersResponseSchema = ZFindResultResponse.extend({
  data: z.array(ZFolderSchema),
});

export const ZFindFoldersInternalRequestSchema = ZFindSearchParamsSchema.extend({
  parentId: z.string().nullable().optional(),
  type: ZFolderTypeSchema.optional(),
});

export const ZFindFoldersInternalResponseSchema = z.object({
  data: z.array(ZFolderWithSubfoldersSchema),
  breadcrumbs: z.array(ZFolderSchema),
  type: ZFolderTypeSchema.optional(),
});

export type TFindFoldersResponse = z.infer<typeof ZFindFoldersResponseSchema>;
