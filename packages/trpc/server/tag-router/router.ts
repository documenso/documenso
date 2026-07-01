import { createTag } from '@documenso/lib/server-only/tag/create-tag';
import { deleteTag } from '@documenso/lib/server-only/tag/delete-tag';
import { findTags } from '@documenso/lib/server-only/tag/find-tags';
import { getEnvelopeTags } from '@documenso/lib/server-only/tag/get-envelope-tags';
import { setEnvelopeTags } from '@documenso/lib/server-only/tag/set-envelope-tags';
import { updateTag } from '@documenso/lib/server-only/tag/update-tag';

import { ZGenericSuccessResponse, ZSuccessResponseSchema } from '../schema';
import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateTagRequestSchema,
  ZCreateTagResponseSchema,
  ZDeleteTagRequestSchema,
  ZFindTagsRequestSchema,
  ZFindTagsResponseSchema,
  ZGetEnvelopeTagsRequestSchema,
  ZGetEnvelopeTagsResponseSchema,
  ZSetEnvelopeTagsRequestSchema,
  ZSetEnvelopeTagsResponseSchema,
  ZUpdateTagRequestSchema,
  ZUpdateTagResponseSchema,
} from './schema';

export const tagRouter = router({
  /**
   * @public
   */
  findTags: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/tag',
        summary: 'Find tags',
        description: 'Find tags for the current team based on a search criteria',
        tags: ['Tag'],
      },
    })
    .input(ZFindTagsRequestSchema)
    .output(ZFindTagsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { type, query, page, perPage } = input;

      ctx.logger.info({
        input: {
          type,
          query,
        },
      });

      return await findTags({
        userId: user.id,
        teamId,
        type,
        query,
        page,
        perPage,
      });
    }),

  /**
   * @private
   */
  getEnvelopeTags: authenticatedProcedure
    .input(ZGetEnvelopeTagsRequestSchema)
    .output(ZGetEnvelopeTagsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { envelopeId } = input;

      ctx.logger.info({
        input: {
          envelopeId,
        },
      });

      return await getEnvelopeTags({
        userId: user.id,
        teamId,
        envelopeId,
      });
    }),

  /**
   * @public
   */
  createTag: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/tag/create',
        summary: 'Create tag',
        description: 'Creates a new tag in your team',
        tags: ['Tag'],
      },
    })
    .input(ZCreateTagRequestSchema)
    .output(ZCreateTagResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { name, type } = input;

      ctx.logger.info({
        input: {
          type,
        },
      });

      return await createTag({
        userId: user.id,
        teamId,
        name,
        type,
      });
    }),

  /**
   * @public
   */
  updateTag: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/tag/update',
        summary: 'Update tag',
        description: 'Updates an existing tag',
        tags: ['Tag'],
      },
    })
    .input(ZUpdateTagRequestSchema)
    .output(ZUpdateTagResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { tagId, data } = input;

      ctx.logger.info({
        input: {
          tagId,
        },
      });

      return await updateTag({
        userId: user.id,
        teamId,
        tagId,
        data,
      });
    }),

  /**
   * @public
   */
  deleteTag: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/tag/delete',
        summary: 'Delete tag',
        description: 'Deletes an existing tag and removes it from all assigned envelopes',
        tags: ['Tag'],
      },
    })
    .input(ZDeleteTagRequestSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { tagId } = input;

      ctx.logger.info({
        input: {
          tagId,
        },
      });

      await deleteTag({
        userId: user.id,
        teamId,
        tagId,
      });

      return ZGenericSuccessResponse;
    }),

  /**
   * @public
   */
  setEnvelopeTags: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/tag/assign',
        summary: 'Set envelope tags',
        description: 'Set the full set of tags assigned to an envelope',
        tags: ['Tag'],
      },
    })
    .input(ZSetEnvelopeTagsRequestSchema)
    .output(ZSetEnvelopeTagsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { envelopeId, tagIds } = input;

      ctx.logger.info({
        input: {
          envelopeId,
          tagCount: tagIds.length,
        },
      });

      return await setEnvelopeTags({
        userId: user.id,
        teamId,
        envelopeId,
        tagIds,
      });
    }),
});
