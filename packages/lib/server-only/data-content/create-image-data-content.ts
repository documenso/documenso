import { prisma } from '@documenso/prisma';

import { DataContentType } from '../../types/data-content-meta';
import { generateDatabaseId } from '../../universal/id';
import { putFileServerSide } from '../../universal/upload/put-file.server';
import { getNormalizedImageFileName, type NormalizeImageOptions, normalizeImage } from './normalize-image';

export type CreateImageDataContentOptions = {
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
 * `setEnvelopeContents`, which is also where it is cleaned up once no longer
 * referenced.
 */
export const createImageDataContent = async ({ file, normalizeOptions }: CreateImageDataContentOptions) => {
  const normalized = await normalizeImage(Buffer.from(await file.arrayBuffer()), normalizeOptions);

  const fileName = getNormalizedImageFileName(file.name, normalized.mimeType);

  const { type, data } = await putFileServerSide({
    name: fileName,
    type: normalized.mimeType,
    arrayBuffer: async () => toArrayBuffer(normalized.buffer),
  });

  return await prisma.dataContent.create({
    data: {
      id: generateDatabaseId('data'),
      type,
      data,
      metadata: {
        type: DataContentType.IMAGE,
        width: normalized.width,
        height: normalized.height,
        mimeType: normalized.mimeType,
        fileName,
        fileSize: normalized.buffer.byteLength,
      },
    },
  });
};

/**
 * Node buffers may be views over a larger shared pool, so the exact byte
 * range is copied into a standalone array buffer.
 */
const toArrayBuffer = (buffer: Buffer): ArrayBuffer => {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};
