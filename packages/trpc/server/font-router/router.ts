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

    return await createFontAsset({
      userId: ctx.user.id,
      target: input.target,
      file: {
        name: input.fileName,
        displayName: input.displayName,
        type: input.mimeType,
        size: input.fileSize,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      },
    });
  }),

  delete: authenticatedProcedure.input(ZDeleteFontRequestSchema).mutation(async ({ input, ctx }) => {
    await deleteFontAsset({
      userId: ctx.user.id,
      fontId: input.fontId,
    });
  }),
});
