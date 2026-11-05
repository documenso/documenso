import { z } from 'zod';

export enum DataContentType {
  IMAGE = 'image',
}

export const ZDataContentTypeSchema = z.nativeEnum(DataContentType);

export const ZDataContentImageMeta = z.object({
  type: z.literal(DataContentType.IMAGE),

  // Intrinsic pixel dimensions, recorded on upload so renderers can resolve the aspect ratio before the bytes are loaded.
  width: z.number().int().positive(),
  height: z.number().int().positive(),

  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),

  fileName: z.string().max(255),

  fileSize: z.number().int().nonnegative(),
});

export type TDataContentImageMeta = z.infer<typeof ZDataContentImageMeta>;

export const ZDataContentMetaSchema = z.discriminatedUnion('type', [ZDataContentImageMeta]);

export type TDataContentMeta = z.infer<typeof ZDataContentMetaSchema>;
