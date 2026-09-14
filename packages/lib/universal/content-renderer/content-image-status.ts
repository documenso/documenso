/**
 * The loading status of a content image. `loaded` and `failed` are terminal.
 */
export type ContentImageStatus = 'loading' | 'loaded' | 'failed';

export type ContentImageStatusMap = ReadonlyMap<string, ContentImageStatus>;

/**
 * The minimum shape of a content needed to locate its image on a page.
 */
type PageContent = {
  envelopeItemId: string;
  dataContentId: string | null;
  metadata: {
    page?: number | undefined;
  };
};

type PageContentsOptions = {
  contents: PageContent[];
  pageNumber: number;
  envelopeItemId: string;
};

type PageContentImagesOptions = PageContentsOptions & {
  statuses: ContentImageStatusMap;

  /**
   * The images which are actually being loaded.
   *
   * Not every image belonging to a content is requested: a sealed envelope
   * has its contents imprinted on the PDF, so nothing is loaded for it. Those
   * images are never going to get a status, so they must not be waited on.
   */
  requestedDataContentIds: ReadonlySet<string>;
};

/**
 * The IDs of the data contents attached to the contents on the given page of
 * the given envelope item.
 *
 * Contents without a page are on the first page.
 */
export const getPageContentDataContentIds = ({ contents, pageNumber, envelopeItemId }: PageContentsOptions) => {
  return contents.flatMap((content) => {
    const isOnPage = content.envelopeItemId === envelopeItemId && (content.metadata.page ?? 1) === pageNumber;

    return isOnPage && content.dataContentId ? [content.dataContentId] : [];
  });
};

/**
 * Whether every content image on the page has reached a terminal status, so
 * the page can be rendered without images arriving afterwards.
 *
 * A failed image counts as ready, otherwise a single broken image would block
 * the page forever. What to render for it is up to the page renderer.
 */
export const areContentImagesReady = ({ statuses, requestedDataContentIds, ...options }: PageContentImagesOptions) => {
  return getPageContentDataContentIds(options)
    .filter((dataContentId) => requestedDataContentIds.has(dataContentId))
    .every((dataContentId) => {
      const status = statuses.get(dataContentId);

      return status === 'loaded' || status === 'failed';
    });
};

/**
 * Whether any content image on the page failed to load.
 */
export const hasFailedContentImage = ({ statuses, requestedDataContentIds, ...options }: PageContentImagesOptions) => {
  return getPageContentDataContentIds(options)
    .filter((dataContentId) => requestedDataContentIds.has(dataContentId))
    .some((dataContentId) => statuses.get(dataContentId) === 'failed');
};
