import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error';
import {
  CONTENT_IMAGE_META_DEFAULT_VALUES,
  CONTENT_MAX_Z_INDEX,
  CONTENT_TEXT_META_DEFAULT_VALUES,
  EnvelopeContentType,
} from '../types/envelope-content-meta';
import {
  assertEnvelopeContentLimits,
  assertEnvelopeContentSaveWithinLimits,
  buildEnvelopeContentCopyData,
  getContentsMissingImages,
  getDataContentIds,
  getNextContentZIndex,
  isContentOnTop,
  resolveEnvelopeContentLimits,
  sortContentsForRender,
} from './envelope-content';

const content = (type: EnvelopeContentType, dataContentId: string | null, id = `${type}_${dataContentId}`) => ({
  id,
  dataContentId,
  contentMeta: { type },
});

describe('getDataContentIds', () => {
  it('returns the distinct attached data content ids in first seen order', () => {
    const ids = getDataContentIds([
      { dataContentId: 'data_b' },
      { dataContentId: null },
      { dataContentId: 'data_a' },
      { dataContentId: 'data_b' },
      { dataContentId: undefined },
    ]);

    expect(ids).toEqual(['data_b', 'data_a']);
  });

  it('is empty when nothing has data attached', () => {
    expect(getDataContentIds([{ dataContentId: null }, {}])).toEqual([]);
  });
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
    const sorted = sortContentsForRender(
      [
        { id: 'a', zIndex: 2 },
        { id: 'b', zIndex: 0 },
        { id: 'c', zIndex: 1 },
      ],
      (content) => content.zIndex,
    );

    expect(sorted.map((content) => content.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks zIndex ties by id so the order is deterministic', () => {
    const sorted = sortContentsForRender(
      [
        { id: 'zeta', zIndex: 1 },
        { id: 'alpha', zIndex: 1 },
        { id: 'mid', zIndex: 1 },
      ],
      (content) => content.zIndex,
    );

    expect(sorted.map((content) => content.id)).toEqual(['alpha', 'mid', 'zeta']);
  });

  it('orders by zIndex first and only falls back to id within a tie', () => {
    // Mixes tied and distinct zIndexes, with ids chosen so that sorting by id
    // alone, or letting an id comparison leak across zIndex groups, would
    // produce a different order.
    const sorted = sortContentsForRender(
      [
        { id: 'a', zIndex: 2 },
        { id: 'z', zIndex: 0 },
        { id: 'b', zIndex: 2 },
        { id: 'y', zIndex: 1 },
        { id: 'c', zIndex: 0 },
        { id: 'x', zIndex: 1 },
      ],
      (content) => content.zIndex,
    );

    expect(sorted.map((content) => content.id)).toEqual(['c', 'z', 'x', 'y', 'a', 'b']);
  });

  it('does not mutate the input', () => {
    const contents = [
      { id: 'a', zIndex: 1 },
      { id: 'b', zIndex: 0 },
    ];

    sortContentsForRender(contents, (content) => content.zIndex);

    expect(contents.map((content) => content.id)).toEqual(['a', 'b']);
  });
});

describe('getNextContentZIndex', () => {
  it('is one above the highest zIndex', () => {
    expect(getNextContentZIndex([0, 5, 2])).toBe(6);
  });

  it('starts at zero with no contents', () => {
    expect(getNextContentZIndex([])).toBe(0);
  });

  it('is clamped to the ceiling so a full page still accepts contents', () => {
    expect(getNextContentZIndex([CONTENT_MAX_Z_INDEX])).toBe(CONTENT_MAX_Z_INDEX);
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

describe('buildEnvelopeContentCopyData', () => {
  const sourceContent = (envelopeItemId: string, dataContentId: string | null = null) => ({
    id: `envelope_content_source_${envelopeItemId}`,
    envelopeId: 'envelope_source',
    envelopeItemId,
    contentMeta: dataContentId
      ? { ...CONTENT_IMAGE_META_DEFAULT_VALUES, page: 2 }
      : { ...CONTENT_TEXT_META_DEFAULT_VALUES, text: 'Approved' },
    dataContentId,
  });

  it('places each content on the copy of the item it came from', () => {
    const rows = buildEnvelopeContentCopyData({
      contents: [sourceContent('item_a'), sourceContent('item_b'), sourceContent('item_a')],
      envelopeId: 'envelope_dest',
      envelopeItemIdMap: {
        item_a: 'item_a_copy',
        item_b: 'item_b_copy',
      },
    });

    expect(rows.map((row) => row.envelopeItemId)).toEqual(['item_a_copy', 'item_b_copy', 'item_a_copy']);
    expect(rows.every((row) => row.envelopeId === 'envelope_dest')).toBe(true);
  });

  it('gives every copy a fresh id rather than reusing the source id', () => {
    const rows = buildEnvelopeContentCopyData({
      contents: [sourceContent('item_a'), sourceContent('item_a')],
      envelopeId: 'envelope_dest',
      envelopeItemIdMap: { item_a: 'item_a_copy' },
    });

    const ids = rows.map((row) => row.id);

    expect(ids.every((id) => id.startsWith('envelope_content_'))).toBe(true);
    expect(ids.some((id) => id.startsWith('envelope_content_source_'))).toBe(false);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries the content meta and shares the data content rather than copying it', () => {
    const [row] = buildEnvelopeContentCopyData({
      contents: [sourceContent('item_a', 'data_image')],
      envelopeId: 'envelope_dest',
      envelopeItemIdMap: { item_a: 'item_a_copy' },
    });

    expect(row.contentMeta).toEqual({ ...CONTENT_IMAGE_META_DEFAULT_VALUES, page: 2 });
    expect(row.dataContentId).toBe('data_image');
  });

  it('returns nothing for an envelope without contents', () => {
    expect(
      buildEnvelopeContentCopyData({
        contents: [],
        envelopeId: 'envelope_dest',
        envelopeItemIdMap: { item_a: 'item_a_copy' },
      }),
    ).toEqual([]);
  });

  it('throws when a content is on an item which was not copied', () => {
    const build = () =>
      buildEnvelopeContentCopyData({
        contents: [sourceContent('item_a'), sourceContent('item_orphan')],
        envelopeId: 'envelope_dest',
        envelopeItemIdMap: { item_a: 'item_a_copy' },
      });

    expect(build).toThrow(AppError);
    expect(build).toThrow('item_orphan');
  });
});
