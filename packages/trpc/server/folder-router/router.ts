import { TRPCError } from '@trpc/server';

import { createFolder } from '@documenso/lib/server-only/folder/create-folder';
import { deleteFolder } from '@documenso/lib/server-only/folder/delete-folder';
import { findFolders } from '@documenso/lib/server-only/folder/find-folders';
import { getFolderBreadcrumbs } from '@documenso/lib/server-only/folder/get-folder-breadcrumbs';
import { getFolderById } from '@documenso/lib/server-only/folder/get-folder-by-id';
import { moveDocumentToFolder } from '@documenso/lib/server-only/folder/move-document-to-folder';
import { moveFolder } from '@documenso/lib/server-only/folder/move-folder';
import { updateFolder } from '@documenso/lib/server-only/folder/update-folder';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateFolderSchema,
  ZDeleteFolderSchema,
  ZFindFoldersRequestSchema,
  ZFindFoldersResponseSchema,
  ZGenericSuccessResponse,
  ZGetFoldersResponseSchema,
  ZGetFoldersSchema,
  ZMoveDocumentToFolderSchema,
  ZMoveFolderSchema,
  ZSuccessResponseSchema,
  ZUpdateFolderSchema,
} from './schema';

export const folderRouter = router({
  /**
   * @private
   */
  getFolders: authenticatedProcedure
    .input(ZGetFoldersSchema)
    .output(ZGetFoldersResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { parentId } = input;

      const folders = await findFolders({
        userId: user.id,
        teamId,
        parentId,
      });

      const breadcrumbs = parentId
        ? await getFolderBreadcrumbs({
            userId: user.id,
            teamId,
            folderId: parentId,
          })
        : [];

      return {
        folders,
        breadcrumbs,
      };
    }),

  /**
   * @private
   */
  findFolders: authenticatedProcedure
    .input(ZFindFoldersRequestSchema)
    .output(ZFindFoldersResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { parentId, page = 1, perPage = 10 } = input;

      const folders = await findFolders({
        userId: user.id,
        teamId,
        parentId,
        page,
        perPage,
      });

      const breadcrumbs = parentId
        ? await getFolderBreadcrumbs({
            userId: user.id,
            teamId,
            folderId: parentId,
          })
        : [];

      return {
        data: folders,
        breadcrumbs,
        currentPage: page,
        perPage,
        totalPages: 1, // We don't paginate folders for now
        count: folders.length, // Add count property to satisfy the type
      };
    }),

  /**
   * @private
   */
  createFolder: authenticatedProcedure
    .input(ZCreateFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { name, parentId } = input;

      // Verify parent folder exists and belongs to the user/team if provided
      if (parentId) {
        try {
          await getFolderById({
            userId: user.id,
            teamId,
            folderId: parentId,
          });
        } catch (error) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent folder not found',
          });
        }
      }

      return await createFolder({
        userId: user.id,
        teamId,
        name,
        parentId,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @private
   */
  updateFolder: authenticatedProcedure
    .input(ZUpdateFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { id, name } = input;

      return await updateFolder({
        userId: user.id,
        teamId,
        folderId: id,
        name,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @private
   */
  deleteFolder: authenticatedProcedure
    .input(ZDeleteFolderSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { id } = input;

      await deleteFolder({
        userId: user.id,
        teamId,
        folderId: id,
        requestMetadata: ctx.metadata,
      });

      return ZGenericSuccessResponse;
    }),

  /**
   * @private
   */
  moveFolder: authenticatedProcedure.input(ZMoveFolderSchema).mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { id, parentId } = input;

    // Verify parent folder exists and belongs to the user/team if provided
    if (parentId !== null) {
      try {
        await getFolderById({
          userId: user.id,
          teamId,
          folderId: parentId,
        });
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Parent folder not found',
        });
      }
    }

    return await moveFolder({
      userId: user.id,
      teamId,
      folderId: id,
      parentId,
      requestMetadata: ctx.metadata,
    });
  }),

  /**
   * @private
   */
  moveDocumentToFolder: authenticatedProcedure
    .input(ZMoveDocumentToFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { documentId, folderId } = input;

      // Verify folder exists and belongs to the user/team if provided
      if (folderId !== null) {
        try {
          await getFolderById({
            userId: user.id,
            teamId,
            folderId,
          });
        } catch (error) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Folder not found',
          });
        }
      }

      return await moveDocumentToFolder({
        userId: user.id,
        teamId,
        documentId,
        folderId,
        requestMetadata: ctx.metadata,
      });
    }),
});
