import type { EnvelopeContent, OrganisationClaim, Prisma } from '@prisma/client';
import { firstBy, isDeepEqual, isNonNullish, sortBy, unique } from 'remeda';

import { AppError, AppErrorCode } from '../errors/app-error';
import {
  CONTENT_MAX_Z_INDEX,
  CONTENT_TYPE_DATA_CONTENT_TYPE,
  EnvelopeContentType,
} from '../types/envelope-content-meta';
import { generateDatabaseId } from '../universal/id';

type EnvelopeContentWithData = {
  dataContentId: string | null;
  contentMeta: {
    type: EnvelopeContentType;
  };
};

// These render nothing once exported, so an envelope must not be sent while any exist.
export const getContentsMissingImages = <T extends EnvelopeContentWithData>(contents: T[]): T[] => {
  return contents.filter(
    (content) => CONTENT_TYPE_DATA_CONTENT_TYPE[content.contentMeta.type] !== undefined && !content.dataContentId,
  );
};

export const getDataContentIds = (contents: { dataContentId?: string | null }[]) => {
  return unique(contents.map((content) => content.dataContentId).filter(isNonNullish));
};

type EnvelopeContentClaim = Pick<OrganisationClaim, 'envelopeContentCount' | 'envelopeContentImageCount'>;

/**
 * "Reached" means no more can be added, which is what the editor gates on.
 * "Exceeded" means the envelope is over the limit, which is what sending is
 * blocked on. They differ because an envelope can end up over its limit
 * without being edited, e.g. after the organisation's plan is lowered, and
 * such an envelope must still be editable so it can be brought back down.
 */
export const resolveEnvelopeContentLimits = (contentTypes: EnvelopeContentType[], claim: EnvelopeContentClaim) => {
  const contentLimit = claim.envelopeContentCount;
  const imageLimit = claim.envelopeContentImageCount;

  const contentCount = contentTypes.length;
  const imageCount = contentTypes.filter((type) => type === EnvelopeContentType.IMAGE).length;

  return {
    contentLimit,
    imageLimit,
    contentCount,
    imageCount,
    isContentLimitReached: contentLimit > 0 && contentCount >= contentLimit,
    isImageLimitReached: imageLimit > 0 && imageCount >= imageLimit,
    isContentLimitExceeded: contentLimit > 0 && contentCount > contentLimit,
    isImageLimitExceeded: imageLimit > 0 && imageCount > imageLimit,
  };
};

export const assertEnvelopeContentLimits = (contentTypes: EnvelopeContentType[], claim: EnvelopeContentClaim) => {
  const limits = resolveEnvelopeContentLimits(contentTypes, claim);

  if (limits.isContentLimitExceeded) {
    throw new AppError('ENVELOPE_CONTENT_LIMIT_EXCEEDED', {
      message: `You cannot send a document with more than ${limits.contentLimit} contents`,
      statusCode: 400,
    });
  }

  if (limits.isImageLimitExceeded) {
    throw new AppError('ENVELOPE_CONTENT_IMAGE_LIMIT_EXCEEDED', {
      message: `You cannot send a document with more than ${limits.imageLimit} image contents`,
      statusCode: 400,
    });
  }
};

export const assertEnvelopeContentSaveWithinLimits = ({
  incomingTypes,
  existingTypes,
  claim,
}: {
  incomingTypes: EnvelopeContentType[];
  existingTypes: EnvelopeContentType[];
  claim: EnvelopeContentClaim;
}) => {
  const incoming = resolveEnvelopeContentLimits(incomingTypes, claim);
  const existing = resolveEnvelopeContentLimits(existingTypes, claim);

  if (incoming.isContentLimitExceeded && incoming.contentCount > existing.contentCount) {
    throw new AppError('ENVELOPE_CONTENT_LIMIT_EXCEEDED', {
      message: `This envelope cannot have more than ${incoming.contentLimit} contents`,
      statusCode: 400,
    });
  }

  if (incoming.isImageLimitExceeded && incoming.imageCount > existing.imageCount) {
    throw new AppError('ENVELOPE_CONTENT_IMAGE_LIMIT_EXCEEDED', {
      message: `This envelope cannot have more than ${incoming.imageLimit} image contents`,
      statusCode: 400,
    });
  }
};

/**
 * Used to detect whether an envelope's contents have changed between being
 * rendered into its PDF and that render being committed.
 */
export type EnvelopeContentSnapshot = Pick<EnvelopeContent, 'id' | 'envelopeItemId' | 'contentMeta' | 'dataContentId'>;

export const areEnvelopeContentsEqual = (a: EnvelopeContentSnapshot[], b: EnvelopeContentSnapshot[]) => {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = sortBy(a, (content) => content.id);
  const sortedB = sortBy(b, (content) => content.id);

  return sortedA.every((contentA, i) => {
    const contentB = sortedB[i];

    return (
      contentA.id === contentB.id &&
      contentA.envelopeItemId === contentB.envelopeItemId &&
      contentA.dataContentId === contentB.dataContentId &&
      isDeepEqual(contentA.contentMeta, contentB.contentMeta)
    );
  });
};

type OrderedContent = {
  id: string;
  zIndex: number;
};

/**
 * Render order, first to last: `zIndex` ascending, ties broken by `id` so the
 * order is deterministic regardless of the input order. Every renderer
 * (editor, signing, seal) must use this so they agree.
 */
export const sortContentsForRender = <T extends { id: string }>(
  contents: T[],
  getZIndex: (content: T) => number,
): T[] => {
  return sortBy(contents, getZIndex, (content) => content.id);
};

/**
 * The editor must tie-break on the same database ID the other renderers see.
 * An unsaved content has none, but it is also placed above everything else on
 * its page, so it never ties.
 */
export const getLocalContentOrderId = (content: { id?: string | null; formId: string }) => content.id ?? content.formId;

/**
 * Clamped to the ceiling so a page already at it keeps accepting contents,
 * which then tie with the topmost one (and stack by ID) rather than failing
 * validation.
 */
export const getNextContentZIndex = (zIndexes: number[]) => {
  const next = zIndexes.reduce((highest, zIndex) => Math.max(highest, zIndex + 1), 0);

  return Math.min(next, CONTENT_MAX_Z_INDEX);
};

export const isContentOnTop = (contents: OrderedContent[], contentId: string) => {
  // The reverse of the render order, so the same tiebreak applies.
  const topContent = firstBy(contents, [(content) => content.zIndex, 'desc'], [(content) => content.id, 'desc']);

  return topContent?.id === contentId;
};

export type BuildEnvelopeContentCopyDataOptions = {
  contents: Pick<EnvelopeContent, 'envelopeItemId' | 'contentMeta' | 'dataContentId'>[];

  envelopeId: string;

  /**
   * Source item ID to destination item ID. The mapped IDs must belong to
   * `envelopeId`; this is the caller's responsibility since the destination
   * items may not exist yet, and the database does not enforce it either as
   * `envelopeId` and `envelopeItemId` are independent foreign keys.
   */
  envelopeItemIdMap: Record<string, string>;
};

/**
 * Throws rather than skipping a content whose item is not in the map, since
 * dropping it silently would lose authored content.
 *
 * Data contents (e.g. images) are immutable and never deleted, so the copies
 * point at the same ones as the source rather than getting their own.
 */
export const buildEnvelopeContentCopyData = ({
  contents,
  envelopeId,
  envelopeItemIdMap,
}: BuildEnvelopeContentCopyDataOptions): Prisma.EnvelopeContentCreateManyInput[] => {
  return contents.map((content) => {
    const envelopeItemId = envelopeItemIdMap[content.envelopeItemId];

    if (!envelopeItemId) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: `Cannot copy content on envelope item ${content.envelopeItemId}: the item was not copied`,
      });
    }

    return {
      id: generateDatabaseId('envelope_content'),
      envelopeId,
      envelopeItemId,
      contentMeta: content.contentMeta,
      dataContentId: content.dataContentId,
    };
  });
};
