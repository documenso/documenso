import { prisma } from '@documenso/prisma';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DataContentType, ZDataContentMetaSchema } from '../../types/data-content-meta';
import { generateDatabaseId } from '../../universal/id';
import { putFileServerSide } from '../../universal/upload/put-file.server';
import { getNormalizedImageFileName, type NormalizeImageOptions, normalizeImage } from './normalize-image';

export type CreateDataContentImageOptions = {
  file: {
    name: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
  };
  normalizeOptions?: NormalizeImageOptions;
};

/**
 * Normalize an uploaded image, store it and create the data content record
 * describing it.
 *
 * The record is created unlinked. It is attached to an envelope content via
 * `setEnvelopeContents`.
 */
export const createDataContentImage = async ({ file, normalizeOptions }: CreateDataContentImageOptions) => {
  const normalized = await normalizeImage(Buffer.from(await file.arrayBuffer()), normalizeOptions);

  const fileName = getNormalizedImageFileName(file.name, normalized.mimeType);

  // Validate the metadata before anything is written to storage so a bad
  // name or dimension cannot leave behind an orphaned object.
  const parsedMetadata = ZDataContentMetaSchema.safeParse({
    type: DataContentType.IMAGE,
    width: normalized.width,
    height: normalized.height,
    mimeType: normalized.mimeType,
    fileName,
    fileSize: normalized.buffer.byteLength,
  });

  if (!parsedMetadata.success) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Invalid image meta',
    });
  }

  const { type, data } = await putFileServerSide({
    name: fileName,
    type: normalized.mimeType,
    arrayBuffer: async () => Promise.resolve(normalized.buffer),
  });

  return await prisma.dataContent.create({
    data: {
      id: generateDatabaseId('data'),
      type,
      data,
      metadata: parsedMetadata.data,
    },
  });
};
