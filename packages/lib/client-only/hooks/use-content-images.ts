import type { EnvelopeContent } from '@prisma/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ContentImageStatus, ContentImageStatusMap } from '../../universal/content-renderer/content-image-status';
import type { ContentImageMap, ContentImageSource } from '../../universal/content-renderer/content-renderer';
import { getDataContentImageUrl } from '../../utils/envelope-download';
import { type ContentImageDetails, loadContentImage } from '../load-content-image';

export type ContentImages = {
  /**
   * The loaded images by data content ID.
   */
  images: ContentImageMap;

  /**
   * The file details of the loaded images by data content ID, for display.
   */
  details: ReadonlyMap<string, ContentImageDetails>;

  /**
   * The loading status by data content ID. IDs which have not started
   * loading are absent.
   */
  statuses: ContentImageStatusMap;

  /**
   * The images being loaded.
   *
   * An image belonging to a content is not always requested, e.g. nothing is
   * loaded for a sealed envelope since its contents are imprinted on the PDF.
   * Consumers need this to tell an image which is still on its way from one
   * which is never coming.
   */
  requestedDataContentIds: ReadonlySet<string>;

  /**
   * Insert an already decoded image, e.g. an upload decoded locally, so it is
   * available immediately without a request.
   */
  seed: (dataContentId: string, image: ContentImageSource, details: ContentImageDetails) => void;
};

type UseContentImagesOptions = {
  envelopeId: string;

  /**
   * The envelope item currently being rendered. Only its images are loaded.
   */
  envelopeItemId: string | null;

  contents: Pick<EnvelopeContent, 'envelopeItemId' | 'dataContentId'>[];
  token: string | undefined;
  presignToken?: string | undefined;
};

type ContentImagesState = {
  images: Map<string, ContentImageSource>;
  details: Map<string, ContentImageDetails>;
  statuses: Map<string, ContentImageStatus>;
};

const createEmptyState = (): ContentImagesState => ({
  images: new Map(),
  details: new Map(),
  statuses: new Map(),
});

/**
 * Load and cache the images of the image contents of the envelope item being
 * rendered, starting as soon as the contents are known so they are ready by
 * the time the pages render.
 *
 * Images are kept for the lifetime of the provider, including across item
 * switches, so navigating back never refetches or re-decodes. They are only
 * closed on unmount, since a Konva node may still draw an image until its
 * stage is destroyed and drawing a closed bitmap throws.
 */
export const useContentImages = ({
  envelopeId,
  envelopeItemId,
  contents,
  token,
  presignToken,
}: UseContentImagesOptions): ContentImages => {
  const [state, setState] = useState<ContentImagesState>(createEmptyState);

  // Mirrors of the state for the effects, so starting loads does not depend
  // on the state itself (which would re-run the effect on every update) and
  // unmounting can close whatever was loaded.
  const statusesRef = useRef(state.statuses);
  const imagesRef = useRef(state.images);

  statusesRef.current = state.statuses;
  imagesRef.current = state.images;

  // Bumped on unmount so in-flight loads discard their result.
  const generationRef = useRef(0);

  const requestedDataContentIds = useMemo(() => {
    const ids = contents.flatMap((content) =>
      content.envelopeItemId === envelopeItemId && content.dataContentId ? [content.dataContentId] : [],
    );

    return Array.from(new Set(ids)).sort();
  }, [contents, envelopeItemId]);

  // A stable key so the effect only re-runs when the set of IDs changes.
  const requestedDataContentIdsKey = requestedDataContentIds.join(',');

  useEffect(() => {
    const missingDataContentIds = requestedDataContentIds.filter(
      (dataContentId) => !statusesRef.current.has(dataContentId),
    );

    if (missingDataContentIds.length === 0) {
      return;
    }

    const generation = generationRef.current;

    setState((prev) => ({
      ...prev,
      statuses: withStatuses(prev.statuses, missingDataContentIds, 'loading'),
    }));

    for (const dataContentId of missingDataContentIds) {
      const url = getDataContentImageUrl({ envelopeId, dataContentId, token, presignToken });

      void loadContentImage(url)
        .then(({ image, details }) => {
          if (generationRef.current !== generation) {
            closeImage(image);
            return;
          }

          setState((prev) => ({
            images: new Map(prev.images).set(dataContentId, image),
            details: new Map(prev.details).set(dataContentId, details),
            statuses: withStatuses(prev.statuses, [dataContentId], 'loaded'),
          }));
        })
        .catch((error: unknown) => {
          if (generationRef.current !== generation) {
            return;
          }

          console.error(`Failed to load content image ${dataContentId}`, error);

          setState((prev) => ({
            ...prev,
            statuses: withStatuses(prev.statuses, [dataContentId], 'failed'),
          }));
        });
    }
    // The IDs are tracked via their key so an equal set does not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopeId, requestedDataContentIdsKey, token, presignToken]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;

      for (const image of imagesRef.current.values()) {
        closeImage(image);
      }

      // Also reset the mirrors so a strict mode remount reloads everything
      // rather than reusing closed images.
      imagesRef.current = new Map();
      statusesRef.current = new Map();

      setState(createEmptyState());
    };
  }, []);

  const seed = useCallback((dataContentId: string, image: ContentImageSource, details: ContentImageDetails) => {
    setState((prev) => ({
      images: new Map(prev.images).set(dataContentId, image),
      details: new Map(prev.details).set(dataContentId, details),
      statuses: withStatuses(prev.statuses, [dataContentId], 'loaded'),
    }));
  }, []);

  return useMemo(
    () => ({
      images: state.images,
      details: state.details,
      statuses: state.statuses,

      /**
       * The images being loaded, so consumers can tell an image which is
       * still on its way from one which is never coming.
       */
      requestedDataContentIds: new Set(requestedDataContentIds),
      seed,
    }),
    [state, seed, requestedDataContentIdsKey],
  );
};

const withStatuses = (
  statuses: Map<string, ContentImageStatus>,
  dataContentIds: string[],
  status: ContentImageStatus,
) => {
  const next = new Map(statuses);

  for (const dataContentId of dataContentIds) {
    next.set(dataContentId, status);
  }

  return next;
};

/**
 * Release the memory of a decoded bitmap. Image elements have nothing to
 * release.
 */
const closeImage = (image: ContentImageSource) => {
  if ('close' in image) {
    image.close();
  }
};
