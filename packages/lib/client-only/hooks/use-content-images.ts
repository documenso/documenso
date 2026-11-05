import type { EnvelopeContent } from '@prisma/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ContentImageStatus, ContentImageStatusMap } from '../../universal/content-renderer/content-image-status';
import type { ContentImageMap, ContentImageSource } from '../../universal/content-renderer/content-renderer';
import { getDataContentIds } from '../../utils/envelope-content';
import { getDataContentImageUrl } from '../../utils/envelope-download';
import { type ContentImageDetails, decodeLocalContentImage, loadContentImage } from '../load-content-image';
import { useLatestRef } from './use-latest-ref';

export type ContentImages = {
  images: ContentImageMap;

  details: ReadonlyMap<string, ContentImageDetails>;

  loadingStatuses: ContentImageStatusMap;

  /**
   * Nothing is loaded for a sealed envelope since its contents are imprinted
   * on the PDF, so consumers need this to tell an image which is still on its
   * way from one which is never coming.
   */
  requestedDataContentIds: ReadonlySet<string>;

  setImage: (dataContentId: string, image: ContentImageSource, details: ContentImageDetails) => void;
};

type UseContentImagesOptions = {
  envelopeId: string;

  envelopeItemId: string | null;

  contents: (Pick<EnvelopeContent, 'envelopeItemId' | 'dataContentId'> & { data?: Blob })[];
  token: string | undefined;
  presignToken?: string | undefined;
};

type ContentImagesState = {
  images: Map<string, ContentImageSource>;
  details: Map<string, ContentImageDetails>;
  loadingStatuses: Map<string, ContentImageStatus>;
};

const createEmptyState = (): ContentImagesState => ({
  images: new Map(),
  details: new Map(),
  loadingStatuses: new Map(),
});

/**
 * Images are kept across item switches and only closed on unmount, since a
 * Konva node may still draw an image until its stage is destroyed and drawing
 * a closed bitmap throws.
 */
export const useContentImages = ({
  envelopeId,
  envelopeItemId,
  contents,
  token,
  presignToken,
}: UseContentImagesOptions): ContentImages => {
  const [state, setState] = useState<ContentImagesState>(createEmptyState);

  const contentsRef = useLatestRef(contents);

  const loadingStatusesRef = useLatestRef(state.loadingStatuses);
  const imagesRef = useLatestRef(state.images);

  // Bumped on unmount so a load started under a previous mount discards its
  // result rather than writing into state which has since been cleared.
  const mountIdRef = useRef(0);

  const requestedDataContentIds = useMemo(() => {
    const itemContents = contents.filter((content) => content.envelopeItemId === envelopeItemId);

    return getDataContentIds(itemContents).sort();
  }, [contents, envelopeItemId]);

  const requestedDataContentIdsKey = requestedDataContentIds.join(',');

  useEffect(() => {
    const unrequestedDataContentIds = requestedDataContentIds.filter(
      (dataContentId) => !loadingStatusesRef.current.has(dataContentId),
    );

    if (unrequestedDataContentIds.length === 0) {
      return;
    }

    const mountId = mountIdRef.current;

    setState((prev) => ({
      ...prev,
      loadingStatuses: setDataContentStatuses(prev.loadingStatuses, unrequestedDataContentIds, 'loading'),
    }));

    for (const dataContentId of unrequestedDataContentIds) {
      const localImage = contentsRef.current.find(
        (content) => content.dataContentId === dataContentId && content.data,
      )?.data;

      const loadImage = localImage
        ? decodeLocalContentImage(localImage)
        : loadContentImage(getDataContentImageUrl({ envelopeId, dataContentId, token, presignToken }));

      void loadImage
        .then(({ image, details }) => {
          if (mountIdRef.current !== mountId) {
            closeImage(image);
            return;
          }

          setState((prev) => ({
            images: new Map(prev.images).set(dataContentId, image),
            details: new Map(prev.details).set(dataContentId, details),
            loadingStatuses: setDataContentStatuses(prev.loadingStatuses, [dataContentId], 'loaded'),
          }));
        })
        .catch((error: unknown) => {
          if (mountIdRef.current !== mountId) {
            return;
          }

          console.error(`Failed to load content image ${dataContentId}`, error);

          setState((prev) => ({
            ...prev,
            loadingStatuses: setDataContentStatuses(prev.loadingStatuses, [dataContentId], 'failed'),
          }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopeId, requestedDataContentIdsKey, token, presignToken]);

  useEffect(() => {
    return () => {
      mountIdRef.current += 1;

      for (const image of imagesRef.current.values()) {
        closeImage(image);
      }

      // Reset the mirrors so a strict mode remount reloads everything rather
      // than reusing closed images.
      imagesRef.current = new Map();
      loadingStatusesRef.current = new Map();

      setState(createEmptyState());
    };
  }, []);

  const setImage = useCallback((dataContentId: string, image: ContentImageSource, details: ContentImageDetails) => {
    setState((prev) => ({
      images: new Map(prev.images).set(dataContentId, image),
      details: new Map(prev.details).set(dataContentId, details),
      loadingStatuses: setDataContentStatuses(prev.loadingStatuses, [dataContentId], 'loaded'),
    }));
  }, []);

  return useMemo(
    () => ({
      images: state.images,
      details: state.details,
      loadingStatuses: state.loadingStatuses,

      requestedDataContentIds: new Set(requestedDataContentIds),
      setImage,
    }),
    [state, setImage, requestedDataContentIdsKey],
  );
};

const setDataContentStatuses = (
  loadingStatuses: Map<string, ContentImageStatus>,
  dataContentIds: string[],
  status: ContentImageStatus,
) => {
  const remappedLoadingStatuses = new Map(loadingStatuses);

  for (const dataContentId of dataContentIds) {
    remappedLoadingStatuses.set(dataContentId, status);
  }

  return remappedLoadingStatuses;
};

const closeImage = (image: ContentImageSource) => {
  if ('close' in image) {
    image.close();
  }
};
