import { TRPCError } from '@trpc/server';

import { createFolder } from '@documenso/lib/server-only/folder/create-folder';
import { deleteFolder } from '@documenso/lib/server-only/folder/delete-folder';
import { findFolders } from '@documenso/lib/server-only/folder/find-folders';
import { getFolderBreadcrumbs } from '@documenso/lib/server-only/folder/get-folder-breadcrumbs';
import { getFolderById } from '@documenso/lib/server-only/folder/get-folder-by-id';
import { moveDocumentToFolder } from '@documenso/lib/server-only/folder/move-document-to-folder';
import { moveFolder } from '@documenso/lib/server-only/folder/move-folder';
import { moveTemplateToFolder } from '@documenso/lib/server-only/folder/move-template-to-folder';
import { pinFolder } from '@documenso/lib/server-only/folder/pin-folder';
import { unpinFolder } from '@documenso/lib/server-only/folder/unpin-folder';
import { updateFolder } from '@documenso/lib/server-only/folder/update-folder';
import { FolderType } from '@documenso/lib/types/folder-type';

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
  ZMoveTemplateToFolderSchema,
  ZPinFolderSchema,
  ZSuccessResponseSchema,
  ZUnpinFolderSchema,
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
      const { parentId, type } = input;

      const folders = await findFolders({
        userId: user.id,
        teamId,
        parentId,
        type,
      });

      const breadcrumbs = parentId
        ? await getFolderBreadcrumbs({
            userId: user.id,
            teamId,
            folderId: parentId,
            type,
          })
        : [];

      return {
        folders,
        breadcrumbs,
        type,
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
      const { parentId, type } = input;

      const folders = await findFolders({
        userId: user.id,
        teamId,
        parentId,
        type,
      });

      const breadcrumbs = parentId
        ? await getFolderBreadcrumbs({
            userId: user.id,
            teamId,
            folderId: parentId,
            type,
          })
        : [];

      return {
        data: folders,
        breadcrumbs,
        type,
      };
    }),

  /**
   * @private
   */
  createFolder: authenticatedProcedure
    .input(ZCreateFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { name, parentId, type } = input;

      if (parentId) {
        try {
          await getFolderById({
            userId: user.id,
            teamId,
            folderId: parentId,
            type,
          });
        } catch (error) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent folder not found',
          });
        }
      }

      const result = await createFolder({
        userId: user.id,
        teamId,
        name,
        parentId,
        type,
      });

      return {
        ...result,
        type,
      };
    }),

  /**
   * @private
   */
  updateFolder: authenticatedProcedure
    .input(ZUpdateFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { id, name, visibility } = input;

      const currentFolder = await getFolderById({
        userId: user.id,
        teamId,
        folderId: id,
      });

      const result = await updateFolder({
        userId: user.id,
        teamId,
        folderId: id,
        name,
        visibility,
        type: currentFolder.type,
      });

      return {
        ...result,
        type: currentFolder.type,
      };
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
      });

      return ZGenericSuccessResponse;
    }),

  /**
   * @private
   */
  moveFolder: authenticatedProcedure.input(ZMoveFolderSchema).mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { id, parentId } = input;

    const currentFolder = await getFolderById({
      userId: user.id,
      teamId,
      folderId: id,
    });

    if (parentId !== null) {
      try {
        await getFolderById({
          userId: user.id,
          teamId,
          folderId: parentId,
          type: currentFolder.type,
        });
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Parent folder not found',
        });
      }
    }

    const result = await moveFolder({
      userId: user.id,
      teamId,
      folderId: id,
      parentId,
      requestMetadata: ctx.metadata,
    });

    return {
      ...result,
      type: currentFolder.type,
    };
  }),

  /**
   * @private
   */
  moveDocumentToFolder: authenticatedProcedure
    .input(ZMoveDocumentToFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { documentId, folderId } = input;

      if (folderId !== null) {
        try {
          await getFolderById({
            userId: user.id,
            teamId,
            folderId,
            type: FolderType.DOCUMENT,
          });
        } catch (error) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Folder not found',
          });
        }
      }

      const result = await moveDocumentToFolder({
        userId: user.id,
        teamId,
        documentId,
        folderId,
        requestMetadata: ctx.metadata,
      });

      return {
        ...result,
        type: FolderType.DOCUMENT,
      };
    }),

  /**
   * @private
   */
  moveTemplateToFolder: authenticatedProcedure
    .input(ZMoveTemplateToFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { templateId, folderId } = input;

      if (folderId !== null) {
        try {
          await getFolderById({
            userId: user.id,
            teamId,
            folderId,
            type: FolderType.TEMPLATE,
          });
        } catch (error) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Folder not found',
          });
        }
      }

      const result = await moveTemplateToFolder({
        userId: user.id,
        teamId,
        templateId,
        folderId,
      });

      return {
        ...result,
        type: FolderType.TEMPLATE,
      };
    }),

  /**
   * @private
   */
  pinFolder: authenticatedProcedure.input(ZPinFolderSchema).mutation(async ({ ctx, input }) => {
    const currentFolder = await getFolderById({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      folderId: input.folderId,
    });

    const result = await pinFolder({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      folderId: input.folderId,
      type: currentFolder.type,
    });

    return {
      ...result,
      type: currentFolder.type,
    };
  }),

  /**
   * @private
   */
  unpinFolder: authenticatedProcedure.input(ZUnpinFolderSchema).mutation(async ({ ctx, input }) => {
    const currentFolder = await getFolderById({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      folderId: input.folderId,
    });

    const result = await unpinFolder({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      folderId: input.folderId,
      type: currentFolder.type,
    });

    return {
      ...result,
      type: currentFolder.type,
    };
  }),
});
