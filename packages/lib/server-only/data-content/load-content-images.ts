import { prisma } from '@documenso/prisma';
import { Image as SkiaImage } from '@documenso/skia-canvas';
import type { EnvelopeContent } from '@prisma/client';

import { DataContentType } from '../../types/data-content-meta';
import type { ContentImageMap, ContentImageSource } from '../../universal/content-renderer/content-renderer';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { getDataContentIds } from '../../utils/envelope-content';

/**
 * Load and decode the images attached to the given contents, keyed by data
 * content ID, ready for the content renderer to draw on the server.
 *
 * Data contents which are not images are skipped.
 */
export const loadContentImages = async (
  contents: Pick<EnvelopeContent, 'dataContentId'>[],
): Promise<ContentImageMap> => {
  const dataContentIds = getDataContentIds(contents);

  if (dataContentIds.length === 0) {
    return new Map();
  }

  const dataContents = await prisma.dataContent.findMany({
    where: {
      id: {
        in: dataContentIds,
      },
    },
  });

  const entries = await Promise.all(
    dataContents.map(async (dataContent): Promise<[string, ContentImageSource] | null> => {
      if (dataContent.metadata.type !== DataContentType.IMAGE) {
        return null;
      }

      const bytes = await getFileServerSide({
        type: dataContent.type,
        data: dataContent.data,
      });

      return [dataContent.id, new SkiaImage(Buffer.from(bytes)) as unknown as ContentImageSource];
    }),
  );

  return new Map(entries.filter((entry) => entry !== null));
};
