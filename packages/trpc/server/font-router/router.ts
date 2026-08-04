import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createFontAsset, deleteFontAsset, listFontAssets } from '@documenso/lib/server-only/fonts/font-assets';
import { base64 } from '@documenso/lib/universal/base64';

import { authenticatedProcedure, router } from '../trpc';
import { ZDeleteFontRequestSchema, ZListFontsRequestSchema, ZUploadFontRequestSchema } from './schema';

export const fontRouter = router({
  list: authenticatedProcedure.input(ZListFontsRequestSchema).query(async ({ input, ctx }) => {
    return await listFontAssets({
      userId: ctx.user.id,
      target: input.target,
    });
  }),

  upload: authenticatedProcedure.input(ZUploadFontRequestSchema).mutation(async ({ input, ctx }) => {
    const bytes = base64.decode(input.bytes);

    try {
      return await createFontAsset({
        userId: ctx.user.id,
        target: input.target,
        file: {
          name: input.fileName,
          displayName: input.displayName,
          type: input.mimeType,
          size: bytes.byteLength,
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        },
      });
    } catch (error) {
      const appError = AppError.parseError(error);

      if (
        appError.code === AppErrorCode.INVALID_BODY ||
        appError.code === AppErrorCode.LIMIT_EXCEEDED ||
        appError.code === AppErrorCode.NOT_FOUND
      ) {
        throw appError;
      }

      throw error;
    }
  }),

  delete: authenticatedProcedure.input(ZDeleteFontRequestSchema).mutation(async ({ input, ctx }) => {
    await deleteFontAsset({
      userId: ctx.user.id,
      fontId: input.fontId,
    });
  }),
});
