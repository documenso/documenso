import { z } from 'zod';

import { DocumentVisibility } from '@documenso/lib/types/document-visibility';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

/**
 * Required for empty responses since we currently can't 201 requests for our openapi setup.
 *
 * Without this it will throw an error in Speakeasy SDK when it tries to parse an empty response.
 */
export const ZSuccessResponseSchema = z.object({
  success: z.literal(true),
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
});

// Using explicit type annotation to avoid circular reference issues
export const ZFolderWithSubfoldersSchema: z.ZodType<{
  id: string;
  name: string;
  userId: number;
  teamId: number | null;
  parentId: string | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  subfolders: Array<{
    id: string;
    name: string;
    userId: number;
    teamId: number | null;
    parentId: string | null;
    pinned: boolean;
    createdAt: Date;
    updatedAt: Date;
    subfolders: unknown[]; // Using unknown instead of any to satisfy ESLint
    _count: {
      documents: number;
      subfolders: number;
    };
  }>;
  _count: {
    documents: number;
    subfolders: number;
  };
}> = ZFolderSchema.extend({
  subfolders: z.lazy(() => ZFolderWithSubfoldersSchema.array()),
  _count: z.object({
    documents: z.number(),
    subfolders: z.number(),
  }),
  pinned: z.boolean(),
});

export type TFolderWithSubfolders = z.infer<typeof ZFolderWithSubfoldersSchema>;

export const ZCreateFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().nullable().optional(),
});

export const ZUpdateFolderSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  visibility: z.nativeEnum(DocumentVisibility),
});

export type TUpdateFolderSchema = z.infer<typeof ZUpdateFolderSchema>;

export const ZDeleteFolderSchema = z.object({
  id: z.string(),
});

export const ZMoveFolderSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
});

export const ZMoveDocumentToFolderSchema = z.object({
  documentId: z.number(),
  folderId: z.string().nullable(),
});

export const ZPinFolderSchema = z.object({
  folderId: z.string(),
});

export const ZUnpinFolderSchema = z.object({
  folderId: z.string(),
});

export const ZGetFoldersSchema = z.object({
  parentId: z.string().nullable().optional(),
});

export const ZGetFoldersResponseSchema = z.object({
  folders: ZFolderWithSubfoldersSchema.array(),
  breadcrumbs: ZFolderSchema.array(),
});

export type TGetFoldersResponse = z.infer<typeof ZGetFoldersResponseSchema>;

export const ZFindFoldersRequestSchema = ZFindSearchParamsSchema.extend({
  parentId: z.string().nullable().optional(),
});

export const ZFindFoldersResponseSchema = z.object({
  data: ZFolderWithSubfoldersSchema.array(),
  breadcrumbs: ZFolderSchema.array(),
});

export type TFindFoldersResponse = z.infer<typeof ZFindFoldersResponseSchema>;
