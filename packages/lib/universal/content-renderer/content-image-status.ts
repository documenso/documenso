import { getDataContentIds } from '../../utils/envelope-content';

export type ContentImageStatus = 'loading' | 'loaded' | 'failed';

export type ContentImageStatusMap = ReadonlyMap<string, ContentImageStatus>;

type PageContent = {
  envelopeItemId: string;
  dataContentId: string | null;
  contentMeta: {
    page?: number | undefined;
  };
};

type PageContentsOptions = {
  contents: PageContent[];
  pageNumber: number;
  envelopeItemId: string;
};

type PageContentImagesOptions = PageContentsOptions & {
  loadingStatuses: ContentImageStatusMap;

  /**
   * Not every image belonging to a content is requested: a sealed envelope
   * has its contents imprinted on the PDF, so nothing is loaded for it. Those
   * images are never going to get a status, so they must not be waited on.
   */
  requestedDataContentIds: ReadonlySet<string>;
};

export const getPageContentDataContentIds = ({ contents, pageNumber, envelopeItemId }: PageContentsOptions) => {
  const pageContents = contents.filter(
    (content) => content.envelopeItemId === envelopeItemId && content.contentMeta.page === pageNumber,
  );

  return getDataContentIds(pageContents);
};

/**
 * A failed image counts as ready, otherwise a single broken image would block
 * the page forever.
 */
export const areContentImagesReady = ({
  loadingStatuses,
  requestedDataContentIds,
  ...options
}: PageContentImagesOptions) => {
  return getPageContentDataContentIds(options)
    .filter((dataContentId) => requestedDataContentIds.has(dataContentId))
    .every((dataContentId) => {
      const status = loadingStatuses.get(dataContentId);

      return status === 'loaded' || status === 'failed';
    });
};

export const hasFailedContentImage = ({
  loadingStatuses,
  requestedDataContentIds,
  ...options
}: PageContentImagesOptions) => {
  return getPageContentDataContentIds(options)
    .filter((dataContentId) => requestedDataContentIds.has(dataContentId))
    .some((dataContentId) => loadingStatuses.get(dataContentId) === 'failed');
};
