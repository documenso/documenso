import type { I18n, MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { EnvelopeContent, OrganisationClaim, Prisma } from '@prisma/client';
import { firstBy, isNonNullish, mapValues, sortBy, unique } from 'remeda';

import { AppError, AppErrorCode } from '../errors/app-error';
import {
  CONTENT_MAX_Z_INDEX,
  CONTENT_TYPE_DATA_CONTENT_TYPE,
  EnvelopeContentShapeType,
  EnvelopeContentType,
} from '../types/envelope-content-meta';
import { generateDatabaseId } from '../universal/id';

// Note: The friendly names live here rather than in the meta types module,
// since that module is imported by the generated Prisma zod schemas and must
// stay free of the lingui macro (which is not transformed everywhere the
// schemas are loaded, e.g. in the e2e test runner).

export const FRIENDLY_CONTENT_TYPE: Record<EnvelopeContentType, MessageDescriptor> = {
  [EnvelopeContentType.TEXT]: msg`Text`,
  [EnvelopeContentType.LINE]: msg`Line`,
  [EnvelopeContentType.SHAPE]: msg`Shape`,
  [EnvelopeContentType.HIGHLIGHT]: msg`Highlight`,
  [EnvelopeContentType.IMAGE]: msg`Image`,
};

export const FRIENDLY_CONTENT_SHAPE_TYPE: Record<EnvelopeContentShapeType, MessageDescriptor> = {
  [EnvelopeContentShapeType.RECTANGLE]: msg`Rectangle`,
};

type EnvelopeContentWithData = {
  dataContentId: string | null;
  contentMeta: {
    type: EnvelopeContentType;
  };
};

/**
 * The contents which hold data (images) but have none attached.
 *
 * Such contents render nothing once exported, so an envelope must not be
 * sent while any exist.
 */
export const getContentsMissingImages = <T extends EnvelopeContentWithData>(contents: T[]): T[] => {
  return contents.filter(
    (content) => CONTENT_TYPE_DATA_CONTENT_TYPE[content.contentMeta.type] !== undefined && !content.dataContentId,
  );
};

/**
 * The distinct IDs of the data contents attached to the given contents, in
 * first seen order. Contents without one are skipped.
 */
export const getDataContentIds = (contents: { dataContentId?: string | null }[]) => {
  return unique(contents.map((content) => content.dataContentId).filter(isNonNullish));
};

/**
 * The per envelope content allowances of an organisation claim, where `0`
 * means unlimited.
 */
type EnvelopeContentClaim = Pick<OrganisationClaim, 'envelopeContentCount' | 'envelopeContentImageCount'>;

/**
 * Resolve how an envelope's contents sit against the organisation's claim.
 *
 * Both limits apply to the whole envelope (every item and page), and image
 * contents count towards both totals whether or not an image is attached.
 *
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

/**
 * Throw when an envelope holds more contents than the organisation's claim
 * allows, used when sending since that is where the limits are enforced.
 */
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

/**
 * Throw when a save would push an envelope further past the organisation's
 * content allowances, used when contents are written.
 *
 * Only additions are rejected. An envelope can already sit over its limit
 * without having been edited, e.g. after the organisation's plan is lowered,
 * and such an envelope must stay saveable so its owner can remove contents
 * until it fits again.
 */
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
 * Resolve the translated names for each content type, used by the content
 * renderer for placeholder labels.
 */
export const getClientSideContentTranslations = ({ t }: I18n): Record<EnvelopeContentType, string> => {
  return mapValues(FRIENDLY_CONTENT_TYPE, (descriptor) => t(descriptor));
};

type OrderedContent = {
  id: string;
  zIndex: number;
};

/**
 * Sort contents into render order, first to last, so the last one draws on
 * top: `zIndex` ascending, ties broken by `id` so the order is deterministic
 * regardless of the input order. Every renderer (editor, signing, seal) must
 * use this so they agree.
 *
 * The `zIndex` lives in the content's `contentMeta`. The accessor lets callers
 * with differently shaped contents (e.g. rows vs. editor contents with a
 * `formId`) share the one sort.
 */
export const sortContentsForRender = <T extends { id: string }>(
  contents: T[],
  getZIndex: (content: T) => number,
): T[] => {
  return sortBy(contents, getZIndex, (content) => content.id);
};

/**
 * The ID an editor content is ordered by.
 *
 * Ties are broken by ID, so the editor has to use the same one the rest of
 * the renderers see, which is the database ID. A content which has not been
 * saved yet has none, but it is also placed above everything else on its
 * page, so it never ties.
 */
export const getLocalContentOrderId = (content: { id?: string | null; formId: string }) => content.id ?? content.formId;

/**
 * The `zIndex` which places a content above every one of the given `zIndex`es.
 *
 * Clamped to the ceiling so a page already at it keeps accepting contents,
 * which then tie with the topmost one (and stack by ID) rather than failing
 * validation.
 */
export const getNextContentZIndex = (zIndexes: number[]) => {
  const next = zIndexes.reduce((highest, zIndex) => Math.max(highest, zIndex + 1), 0);

  return Math.min(next, CONTENT_MAX_Z_INDEX);
};

/**
 * Whether the content renders last, i.e. on top of the others.
 */
export const isContentOnTop = (contents: OrderedContent[], contentId: string) => {
  // The reverse of the render order, so the same tiebreak applies.
  const topContent = firstBy(contents, [(content) => content.zIndex, 'desc'], [(content) => content.id, 'desc']);

  return topContent?.id === contentId;
};

export type BuildEnvelopeContentCopyDataOptions = {
  /**
   * The contents of the source envelope to copy.
   */
  contents: Pick<EnvelopeContent, 'envelopeItemId' | 'contentMeta' | 'dataContentId'>[];

  /**
   * The envelope to copy the contents to.
   */
  envelopeId: string;

  /**
   * Maps the source envelope item IDs to the destination envelope item IDs.
   *
   * Every item which has contents must be mapped. The mapped IDs must belong
   * to `envelopeId`. This is entirely the caller's responsibility: the
   * destination items may not exist yet so it cannot be checked here, and
   * the database does not enforce it either since `envelopeId` and
   * `envelopeItemId` are independent foreign keys.
   */
  envelopeItemIdMap: Record<string, string>;
};

/**
 * The rows to insert when copying the contents of one envelope onto another,
 * e.g. when creating a document from a template or duplicating an envelope.
 *
 * The caller passes the result to `envelopeContent.createMany` once the
 * destination envelope and its items exist.
 *
 * Throws if a content's item is not in the map. A content can only ever live
 * on the copy of the item it came from, so there is no safe place to put it
 * and dropping it silently would lose authored content. This should not
 * happen when the map covers every item of the source envelope.
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
