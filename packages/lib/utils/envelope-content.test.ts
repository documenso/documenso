import { describe, expect, it } from 'vitest';

import { EnvelopeContentType } from '../types/envelope-content-meta';
import {
  assertEnvelopeContentLimits,
  assertEnvelopeContentSaveWithinLimits,
  getContentsMissingImages,
  getNextContentZIndex,
  isContentOnTop,
  resolveEnvelopeContentLimits,
  sortContentsForRender,
} from './envelope-content';

const content = (type: EnvelopeContentType, dataContentId: string | null, id = `${type}_${dataContentId}`) => ({
  id,
  dataContentId,
  metadata: { type },
});

describe('getContentsMissingImages', () => {
  it('returns image contents without an image attached', () => {
    const missing = getContentsMissingImages([
      content(EnvelopeContentType.IMAGE, null, 'image_missing'),
      content(EnvelopeContentType.IMAGE, 'data_1'),
    ]);

    expect(missing.map((missingContent) => missingContent.id)).toEqual(['image_missing']);
  });

  it('ignores content types which do not hold data', () => {
    const missing = getContentsMissingImages([
      content(EnvelopeContentType.TEXT, null),
      content(EnvelopeContentType.LINE, null),
      content(EnvelopeContentType.SHAPE, null),
      content(EnvelopeContentType.HIGHLIGHT, null),
    ]);

    expect(missing).toEqual([]);
  });
});

describe('resolveEnvelopeContentLimits', () => {
  const claim = (envelopeContentCount: number, envelopeContentImageCount: number) => ({
    envelopeContentCount,
    envelopeContentImageCount,
  });

  const contentTypes = (total: number, images: number) => [
    ...Array.from({ length: total - images }, () => EnvelopeContentType.TEXT),
    ...Array.from({ length: images }, () => EnvelopeContentType.IMAGE),
  ];

  it('counts image contents towards both the content and image totals', () => {
    const limits = resolveEnvelopeContentLimits(contentTypes(5, 2), claim(0, 0));

    expect(limits.contentCount).toBe(5);
    expect(limits.imageCount).toBe(2);
  });

  it('treats a limit of zero as unlimited', () => {
    const limits = resolveEnvelopeContentLimits(contentTypes(100, 50), claim(0, 0));

    expect(limits.isContentLimitReached).toBe(false);
    expect(limits.isImageLimitReached).toBe(false);
    expect(limits.isContentLimitExceeded).toBe(false);
    expect(limits.isImageLimitExceeded).toBe(false);
  });

  it('is reached at the limit but only exceeded above it', () => {
    const atLimit = resolveEnvelopeContentLimits(contentTypes(3, 0), claim(3, 0));

    expect(atLimit.isContentLimitReached).toBe(true);
    expect(atLimit.isContentLimitExceeded).toBe(false);

    const overLimit = resolveEnvelopeContentLimits(contentTypes(4, 0), claim(3, 0));

    expect(overLimit.isContentLimitReached).toBe(true);
    expect(overLimit.isContentLimitExceeded).toBe(true);
  });

  it('tracks the image limit independently of the content limit', () => {
    const limits = resolveEnvelopeContentLimits(contentTypes(4, 2), claim(10, 2));

    expect(limits.isContentLimitReached).toBe(false);
    expect(limits.isImageLimitReached).toBe(true);
    expect(limits.isImageLimitExceeded).toBe(false);
  });

  it('reports no limits reached for an empty envelope', () => {
    const limits = resolveEnvelopeContentLimits([], claim(1, 1));

    expect(limits.contentCount).toBe(0);
    expect(limits.imageCount).toBe(0);
    expect(limits.isContentLimitReached).toBe(false);
    expect(limits.isImageLimitReached).toBe(false);
  });
});

describe('assertEnvelopeContentLimits', () => {
  const claim = (envelopeContentCount: number, envelopeContentImageCount: number) => ({
    envelopeContentCount,
    envelopeContentImageCount,
  });

  const contentTypes = (total: number, images: number) => [
    ...Array.from({ length: total - images }, () => EnvelopeContentType.TEXT),
    ...Array.from({ length: images }, () => EnvelopeContentType.IMAGE),
  ];

  it('passes when within the limits', () => {
    expect(() => assertEnvelopeContentLimits(contentTypes(3, 1), claim(3, 1))).not.toThrow();
  });

  it('passes when the limits are unlimited', () => {
    expect(() => assertEnvelopeContentLimits(contentTypes(50, 25), claim(0, 0))).not.toThrow();
  });

  it('throws when over the content limit', () => {
    expect(() => assertEnvelopeContentLimits(contentTypes(4, 0), claim(3, 0))).toThrowError(
      expect.objectContaining({ code: 'ENVELOPE_CONTENT_LIMIT_EXCEEDED' }),
    );
  });

  it('throws when over the image limit', () => {
    expect(() => assertEnvelopeContentLimits(contentTypes(4, 3), claim(0, 2))).toThrowError(
      expect.objectContaining({ code: 'ENVELOPE_CONTENT_IMAGE_LIMIT_EXCEEDED' }),
    );
  });
});

describe('assertEnvelopeContentSaveWithinLimits', () => {
  const claim = (envelopeContentCount: number, envelopeContentImageCount: number) => ({
    envelopeContentCount,
    envelopeContentImageCount,
  });

  const contentTypes = (total: number, images: number) => [
    ...Array.from({ length: total - images }, () => EnvelopeContentType.TEXT),
    ...Array.from({ length: images }, () => EnvelopeContentType.IMAGE),
  ];

  const save =
    (incoming: EnvelopeContentType[], existing: EnvelopeContentType[], claimValue: ReturnType<typeof claim>) => () =>
      assertEnvelopeContentSaveWithinLimits({ incomingTypes: incoming, existingTypes: existing, claim: claimValue });

  it('allows a save within the limits', () => {
    expect(save(contentTypes(3, 1), contentTypes(2, 1), claim(3, 1))).not.toThrow();
  });

  it('allows anything when the limits are unlimited', () => {
    expect(save(contentTypes(80, 40), contentTypes(0, 0), claim(0, 0))).not.toThrow();
  });

  it('rejects a save which adds beyond the content limit', () => {
    expect(save(contentTypes(4, 0), contentTypes(3, 0), claim(3, 0))).toThrowError(
      expect.objectContaining({ code: 'ENVELOPE_CONTENT_LIMIT_EXCEEDED' }),
    );
  });

  it('rejects a save which adds beyond the image limit', () => {
    expect(save(contentTypes(5, 3), contentTypes(5, 2), claim(0, 2))).toThrowError(
      expect.objectContaining({ code: 'ENVELOPE_CONTENT_IMAGE_LIMIT_EXCEEDED' }),
    );
  });

  // An envelope can sit over its limit without being edited, e.g. after the
  // organisation's plan is lowered. Such an envelope must stay saveable or the
  // owner can never bring it back down.
  it('allows removing contents while already over the limit', () => {
    expect(save(contentTypes(9, 0), contentTypes(10, 0), claim(3, 0))).not.toThrow();
  });

  it('allows editing without changing the count while already over the limit', () => {
    expect(save(contentTypes(10, 4), contentTypes(10, 4), claim(3, 2))).not.toThrow();
  });

  it('still rejects adding while already over the limit', () => {
    expect(save(contentTypes(11, 0), contentTypes(10, 0), claim(3, 0))).toThrowError(
      expect.objectContaining({ code: 'ENVELOPE_CONTENT_LIMIT_EXCEEDED' }),
    );
  });

  it('allows swapping an image for a non-image while over the image limit', () => {
    expect(save(contentTypes(10, 3), contentTypes(10, 4), claim(0, 2))).not.toThrow();
  });
});

describe('sortContentsForRender', () => {
  it('orders by zIndex ascending so higher zIndex renders on top', () => {
    const sorted = sortContentsForRender([
      { id: 'a', zIndex: 2 },
      { id: 'b', zIndex: 0 },
      { id: 'c', zIndex: 1 },
    ]);

    expect(sorted.map((content) => content.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks zIndex ties by id so the order is deterministic', () => {
    const sorted = sortContentsForRender([
      { id: 'zeta', zIndex: 1 },
      { id: 'alpha', zIndex: 1 },
      { id: 'mid', zIndex: 1 },
    ]);

    expect(sorted.map((content) => content.id)).toEqual(['alpha', 'mid', 'zeta']);
  });

  it('does not mutate the input', () => {
    const contents = [
      { id: 'a', zIndex: 1 },
      { id: 'b', zIndex: 0 },
    ];

    sortContentsForRender(contents);

    expect(contents.map((content) => content.id)).toEqual(['a', 'b']);
  });
});

describe('getNextContentZIndex', () => {
  it('is one above the highest zIndex', () => {
    expect(getNextContentZIndex([{ zIndex: 0 }, { zIndex: 5 }, { zIndex: 2 }])).toBe(6);
  });

  it('starts at zero with no contents', () => {
    expect(getNextContentZIndex([])).toBe(0);
  });
});

describe('isContentOnTop', () => {
  const contents = [
    { id: 'a', zIndex: 1 },
    { id: 'b', zIndex: 3 },
    { id: 'c', zIndex: 3 },
  ];

  it('is true for the content which renders last', () => {
    expect(isContentOnTop(contents, 'c')).toBe(true);
  });

  it('is false for a content with a lower zIndex', () => {
    expect(isContentOnTop(contents, 'a')).toBe(false);
  });

  it('is false for a tied content which loses the id tiebreak', () => {
    expect(isContentOnTop(contents, 'b')).toBe(false);
  });
});
