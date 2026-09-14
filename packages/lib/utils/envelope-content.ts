import type { I18n, MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import { AppError } from '../errors/app-error';
import { CONTENT_TYPE_DATA_CONTENT_KIND, ContentShapeType, EnvelopeContentType } from '../types/envelope-content-meta';

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

export const FRIENDLY_CONTENT_SHAPE_TYPE: Record<ContentShapeType, MessageDescriptor> = {
  [ContentShapeType.RECTANGLE]: msg`Rectangle`,
};

type ContentWithData = {
  dataContentId: string | null;
  metadata: {
    type: EnvelopeContentType;
  };
};

/**
 * The contents which hold data (images) but have none attached.
 *
 * Such contents render nothing once exported, so an envelope must not be
 * sent while any exist.
 */
export const getContentsMissingImages = <T extends ContentWithData>(contents: T[]): T[] => {
  return contents.filter(
    (content) => CONTENT_TYPE_DATA_CONTENT_KIND[content.metadata.type] !== undefined && !content.dataContentId,
  );
};

/**
 * The per envelope content allowances of an organisation claim, where `0`
 * means unlimited.
 */
type EnvelopeContentClaim = {
  envelopeContentCount: number;
  envelopeContentImageCount: number;
};

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
  return {
    [EnvelopeContentType.TEXT]: t(FRIENDLY_CONTENT_TYPE[EnvelopeContentType.TEXT]),
    [EnvelopeContentType.LINE]: t(FRIENDLY_CONTENT_TYPE[EnvelopeContentType.LINE]),
    [EnvelopeContentType.SHAPE]: t(FRIENDLY_CONTENT_TYPE[EnvelopeContentType.SHAPE]),
    [EnvelopeContentType.HIGHLIGHT]: t(FRIENDLY_CONTENT_TYPE[EnvelopeContentType.HIGHLIGHT]),
    [EnvelopeContentType.IMAGE]: t(FRIENDLY_CONTENT_TYPE[EnvelopeContentType.IMAGE]),
  };
};

type OrderedContent = {
  id: string;
  zIndex: number;
};

/**
 * Compare two contents by stacking order: `zIndex` ascending, ties broken by
 * `id` so the order is deterministic regardless of the input order.
 */
export const compareContentsForRender = (a: OrderedContent, b: OrderedContent) => {
  if (a.zIndex !== b.zIndex) {
    return a.zIndex - b.zIndex;
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/**
 * Sort contents into render order, first to last, so the last one draws on
 * top. Every renderer (editor, signing, seal) must use this so they agree.
 */
export const sortContentsForRender = <T extends OrderedContent>(contents: T[]): T[] => {
  return [...contents].sort(compareContentsForRender);
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
 * The `zIndex` which places a content above every one of the given contents.
 */
export const getNextContentZIndex = (contents: Pick<OrderedContent, 'zIndex'>[]) => {
  return contents.reduce((highest, content) => Math.max(highest, content.zIndex + 1), 0);
};

/**
 * Whether the content renders last, i.e. on top of the others.
 */
export const isContentOnTop = (contents: OrderedContent[], contentId: string) => {
  const sorted = sortContentsForRender(contents);

  return sorted.length > 0 && sorted[sorted.length - 1].id === contentId;
};
