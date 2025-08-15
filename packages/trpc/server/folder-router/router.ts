import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
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
  ZCreateFolderResponseSchema,
  ZCreateFolderSchema,
  ZDeleteFolderSchema,
  ZFindFoldersRequestSchema,
  ZFindFoldersResponseSchema,
  ZFolderSchema,
  ZGenericSuccessResponse,
  ZGetFoldersResponseSchema,
  ZGetFoldersSchema,
  ZMoveDocumentToFolderResponseSchema,
  ZMoveDocumentToFolderSchema,
  ZMoveFolderSchema,
  ZMoveTemplateToFolderResponseSchema,
  ZMoveTemplateToFolderSchema,
  ZPinFolderSchema,
  ZSuccessResponseSchema,
  ZUnpinFolderSchema,
  ZUpdateFolderSchema,
} from './schema';

export const folderRouter = router({
  /**
   * @public
   */
  getFolders: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/folders',
        summary: 'Retrieve folders',
        description: 'Returns a list of all your folders',
        tags: ['Folder'],
      },
    })
    .input(ZGetFoldersSchema)
    .output(ZGetFoldersResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { parentId, type } = input;

      ctx.logger.info({
        input: {
          parentId,
          type,
        },
      });

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
    .meta({
      openapi: {
        method: 'GET',
        path: '/folders/find',
        summary: 'Find folders',
        description: 'Find folders based on search criteria',
        tags: ['Folder'],
      },
    })
    .input(ZFindFoldersRequestSchema)
    .output(ZFindFoldersResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { parentId, type } = input;

      ctx.logger.info({
        input: {
          parentId,
          type,
        },
      });

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
   * @public
   */
  createFolder: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/folders/create',
        summary: 'Create new folder',
        description: 'Creates a new folder in your team',
        tags: ['Folder'],
      },
    })
    .input(ZCreateFolderSchema)
    .output(ZCreateFolderResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { name, parentId, type } = input;

      ctx.logger.info({
        input: {
          parentId,
          type,
        },
      });

      if (parentId) {
        try {
          await getFolderById({
            userId: user.id,
            teamId,
            folderId: parentId,
            type,
          });
        } catch (error) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
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

      return result;
    }),

  /**
   * @private
   */
  updateFolder: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/folders/update',
        summary: 'Update folder',
        description: 'Updates an existing folder',
        tags: ['Folder'],
      },
    })
    .input(ZUpdateFolderSchema)
    .output(ZFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { id, name, visibility } = input;

      ctx.logger.info({
        input: {
          id,
        },
      });

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
    .meta({
      openapi: {
        method: 'POST',
        path: '/folders/delete',
        summary: 'Delete folder',
        description: 'Deletes an existing folder',
        tags: ['Folder'],
      },
    })
    .input(ZDeleteFolderSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { id } = input;

      ctx.logger.info({
        input: {
          id,
        },
      });

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
  moveFolder: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/folders/move',
        summary: 'Move folder',
        description: 'Moves a folder to a different parent folder',
        tags: ['Folder'],
      },
    })
    .input(ZMoveFolderSchema)
    .output(ZFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { id, parentId } = input;

      ctx.logger.info({
        input: {
          id,
          parentId,
        },
      });

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
          throw new AppError(AppErrorCode.NOT_FOUND, {
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/folders/move-document',
        summary: 'Move document to folder',
        description: 'Moves a document to a specific folder',
        tags: ['Folder'],
      },
    })
    .input(ZMoveDocumentToFolderSchema)
    .output(ZMoveDocumentToFolderResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { documentId, folderId } = input;

      ctx.logger.info({
        input: {
          documentId,
          folderId,
        },
      });

      if (folderId !== null) {
        try {
          await getFolderById({
            userId: user.id,
            teamId,
            folderId,
            type: FolderType.DOCUMENT,
          });
        } catch (error) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/folders/move-template',
        summary: 'Move template to folder',
        description: 'Moves a template to a specific folder',
        tags: ['Folder'],
      },
    })
    .input(ZMoveTemplateToFolderSchema)
    .output(ZMoveTemplateToFolderResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { templateId, folderId } = input;

      ctx.logger.info({
        input: {
          templateId,
          folderId,
        },
      });

      if (folderId !== null) {
        try {
          await getFolderById({
            userId: user.id,
            teamId,
            folderId,
            type: FolderType.TEMPLATE,
          });
        } catch (error) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
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
  pinFolder: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/folders/pin',
        summary: 'Pin folder',
        description: 'Pins a folder for quick access',
        tags: ['Folder'],
      },
    })
    .input(ZPinFolderSchema)
    .output(ZFolderSchema)
    .mutation(async ({ ctx, input }) => {
      const { folderId } = input;

      ctx.logger.info({
        input: {
          folderId,
        },
      });

      const currentFolder = await getFolderById({
        userId: ctx.user.id,
        teamId: ctx.teamId,
        folderId,
      });

      const result = await pinFolder({
        userId: ctx.user.id,
        teamId: ctx.teamId,
        folderId,
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
  unpinFolder: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/folders/unpin',
        summary: 'Unpin folder',
        description: 'Unpins a previously pinned folder',
        tags: ['Folder'],
      },
    })
    .input(ZUnpinFolderSchema)
    .output(ZFolderSchema)
    .mutation(async ({ ctx, input }) => {
      const { folderId } = input;

      ctx.logger.info({
        input: {
          folderId,
        },
      });

      const currentFolder = await getFolderById({
        userId: ctx.user.id,
        teamId: ctx.teamId,
        folderId,
      });

      const result = await unpinFolder({
        userId: ctx.user.id,
        teamId: ctx.teamId,
        folderId,
        type: currentFolder.type,
      });

      return {
        ...result,
        type: currentFolder.type,
      };
    }),
});
