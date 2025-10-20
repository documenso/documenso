import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createFolder } from '@documenso/lib/server-only/folder/create-folder';
import { deleteFolder } from '@documenso/lib/server-only/folder/delete-folder';
import { findFolders } from '@documenso/lib/server-only/folder/find-folders';
import { getFolderBreadcrumbs } from '@documenso/lib/server-only/folder/get-folder-breadcrumbs';
import { getFolderById } from '@documenso/lib/server-only/folder/get-folder-by-id';
import { pinFolder } from '@documenso/lib/server-only/folder/pin-folder';
import { unpinFolder } from '@documenso/lib/server-only/folder/unpin-folder';
import { updateFolder } from '@documenso/lib/server-only/folder/update-folder';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateFolderResponseSchema,
  ZCreateFolderSchema,
  ZDeleteFolderSchema,
  ZFindFoldersRequestSchema,
  ZFindFoldersResponseSchema,
  ZGenericSuccessResponse,
  ZGetFoldersResponseSchema,
  ZGetFoldersSchema,
  ZPinFolderSchema,
  ZSuccessResponseSchema,
  ZUnpinFolderSchema,
  ZUpdateFolderResponseSchema,
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
   * @public
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
    .output(ZUpdateFolderResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { id, name, visibility, parentId } = input;

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
        parentId,
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
   * @public
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
  pinFolder: authenticatedProcedure.input(ZPinFolderSchema).mutation(async ({ ctx, input }) => {
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
  unpinFolder: authenticatedProcedure.input(ZUnpinFolderSchema).mutation(async ({ ctx, input }) => {
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
