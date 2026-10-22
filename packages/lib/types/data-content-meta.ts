import { z } from 'zod';

/**
 * The kinds of data a `DataContent` row can hold. Each kind has its own
 * metadata shape, discriminated by `type`.
 */
export enum DataContentType {
  IMAGE = 'image',
}

export const ZDataContentTypeSchema = z.nativeEnum(DataContentType);

// IMAGE DATA CONTENT

export const ZDataContentImageMeta = z.object({
  type: z.literal(DataContentType.IMAGE),

  /**
   * The intrinsic pixel dimensions of the image, recorded on upload so
   * renderers can resolve the aspect ratio before the bytes are loaded.
   */
  width: z.number().int().positive(),
  height: z.number().int().positive(),

  /**
   * The MIME type of the stored bytes.
   */
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),

  /**
   * The file name as uploaded, with its extension matching the stored format.
   */
  fileName: z.string().max(255),

  /**
   * The size of the stored bytes.
   */
  fileSize: z.number().int().nonnegative(),
});

export type TDataContentImageMeta = z.infer<typeof ZDataContentImageMeta>;

/**
 * A discriminated union of every data content metadata shape.
 *
 * Add new kinds by extending `DataContentType` and appending the kind's
 * schema here.
 */
export const ZDataContentMetaSchema = z.discriminatedUnion('type', [ZDataContentImageMeta]);

export type TDataContentMeta = z.infer<typeof ZDataContentMetaSchema>;
