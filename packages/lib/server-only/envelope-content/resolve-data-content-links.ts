import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDataContentMeta } from '../../types/data-content-meta';
import { CONTENT_TYPE_DATA_CONTENT_KIND, type EnvelopeContentType } from '../../types/envelope-content-meta';

export type ResolveDataContentLinksOptions = {
  envelopeId: string;

  contents: {
    /**
     * The ID of the persisted content being updated, or null when the content
     * is being created.
     */
    persistedId: string | null;
    contentType: EnvelopeContentType;
    dataContentId?: string | null;
  }[];

  /**
   * The data contents referenced by the request, as currently stored.
   */
  dataContents: {
    id: string;
    metadata: TDataContentMeta;
    envelopeContent: {
      id: string;
      envelopeId: string;
    } | null;
  }[];
};

export type DataContentLink =
  | { action: 'none' }
  | { action: 'keep'; dataContentId: string }
  | { action: 'link'; dataContentId: string }
  | { action: 'clone'; sourceDataContentId: string };

/**
 * Decide how each content's requested data content should be attached.
 *
 * A data content belongs to exactly one content, so a data content that is
 * already attached elsewhere (e.g. when a content is duplicated) or claimed
 * more than once in a request is cloned rather than shared.
 *
 * Returns one link per content, in the same order.
 */
export const resolveDataContentLinks = ({
  envelopeId,
  contents,
  dataContents,
}: ResolveDataContentLinksOptions): DataContentLink[] => {
  const claimedDataContentIds = new Set<string>();

  return contents.map((content): DataContentLink => {
    if (!content.dataContentId) {
      return { action: 'none' };
    }

    const dataContent = dataContents.find((candidate) => candidate.id === content.dataContentId);

    // A data content attached to another envelope is reported as missing so
    // the response does not reveal whether the ID exists.
    if (!dataContent || (dataContent.envelopeContent && dataContent.envelopeContent.envelopeId !== envelopeId)) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Data content ${content.dataContentId} not found`,
      });
    }

    const expectedKind = CONTENT_TYPE_DATA_CONTENT_KIND[content.contentType];

    if (!expectedKind || dataContent.metadata.type !== expectedKind) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Data content ${dataContent.id} (${dataContent.metadata.type}) cannot be used by a ${content.contentType} content`,
      });
    }

    const isAlreadyClaimed = claimedDataContentIds.has(dataContent.id);

    claimedDataContentIds.add(dataContent.id);

    if (isAlreadyClaimed) {
      return { action: 'clone', sourceDataContentId: dataContent.id };
    }

    if (!dataContent.envelopeContent) {
      return { action: 'link', dataContentId: dataContent.id };
    }

    if (content.persistedId !== null && dataContent.envelopeContent.id === content.persistedId) {
      return { action: 'keep', dataContentId: dataContent.id };
    }

    return { action: 'clone', sourceDataContentId: dataContent.id };
  });
};
