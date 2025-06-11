import { z } from 'zod';

import { ZFolderTypeSchema } from '@documenso/lib/types/folder-type';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { DocumentVisibility } from '@documenso/prisma/generated/types';

/**
 * Required for empty responses since we currently can't 201 requests for our openapi setup.
 *
 * Without this it will throw an error in Speakeasy SDK when it tries to parse an empty response.
 */
export const ZSuccessResponseSchema = z.object({
  success: z.boolean(),
  type: ZFolderTypeSchema.optional(),
});

export const ZGenericSuccessResponse = {
  success: true,
} satisfies z.infer<typeof ZSuccessResponseSchema>;

export const ZFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.number(),
  teamId: z.number().nullable(),
  parentId: z.string().nullable(),
  pinned: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  visibility: z.nativeEnum(DocumentVisibility),
  type: ZFolderTypeSchema,
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

export const ZCreateFolderSchema = z.object({
  name: z.string(),
  parentId: z.string().optional(),
  type: ZFolderTypeSchema.optional(),
});

export const ZUpdateFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  visibility: z.nativeEnum(DocumentVisibility),
  type: ZFolderTypeSchema.optional(),
});

export type TUpdateFolderSchema = z.infer<typeof ZUpdateFolderSchema>;

export const ZDeleteFolderSchema = z.object({
  id: z.string(),
  type: ZFolderTypeSchema.optional(),
});

export const ZMoveFolderSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  type: ZFolderTypeSchema.optional(),
});

export const ZMoveDocumentToFolderSchema = z.object({
  documentId: z.number(),
  folderId: z.string().nullable().optional(),
  type: z.enum(['DOCUMENT']).optional(),
});

export const ZMoveTemplateToFolderSchema = z.object({
  templateId: z.number(),
  folderId: z.string().nullable().optional(),
  type: z.enum(['TEMPLATE']).optional(),
});

export const ZPinFolderSchema = z.object({
  folderId: z.string(),
  type: ZFolderTypeSchema.optional(),
});

export const ZUnpinFolderSchema = z.object({
  folderId: z.string(),
  type: ZFolderTypeSchema.optional(),
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
  parentId: z.string().nullable().optional(),
  type: ZFolderTypeSchema.optional(),
});

export const ZFindFoldersResponseSchema = z.object({
  data: z.array(ZFolderWithSubfoldersSchema),
  breadcrumbs: z.array(ZFolderSchema),
  type: ZFolderTypeSchema.optional(),
});

export type TFindFoldersResponse = z.infer<typeof ZFindFoldersResponseSchema>;
