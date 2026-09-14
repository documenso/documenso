import { describe, expect, it } from 'vitest';

import { EnvelopeContentType } from '../../types/envelope-content-meta';
import {
  areContentImagesReady,
  type ContentImageStatus,
  getPageContentDataContentIds,
  hasFailedContentImage,
} from './content-image-status';

const ITEM = 'envelope_item_1';

const imageContent = (dataContentId: string | null, page = 1, envelopeItemId = ITEM) => ({
  envelopeItemId,
  dataContentId,
  metadata: { type: EnvelopeContentType.IMAGE, page },
});

const textContent = (page = 1) => ({
  envelopeItemId: ITEM,
  dataContentId: null,
  metadata: { type: EnvelopeContentType.TEXT, page },
});

const statuses = (entries: Record<string, ContentImageStatus>) => new Map(Object.entries(entries));

/** Most cases load every image belonging to the contents they are given. */
const ALL_REQUESTED = new Set(['data_1', 'data_2', 'data_3']);

describe('getPageContentDataContentIds', () => {
  it('returns the data content ids of the contents on the page of the item', () => {
    const ids = getPageContentDataContentIds({
      contents: [
        imageContent('data_1', 1),
        imageContent('data_2', 2),
        imageContent('data_3', 1, 'envelope_item_other'),
        imageContent(null, 1),
        textContent(1),
      ],
      pageNumber: 1,
      envelopeItemId: ITEM,
    });

    expect(ids).toEqual(['data_1']);
  });

  it('treats contents without a page as being on the first page', () => {
    const ids = getPageContentDataContentIds({
      contents: [{ envelopeItemId: ITEM, dataContentId: 'data_1', metadata: {} }],
      pageNumber: 1,
      envelopeItemId: ITEM,
    });

    expect(ids).toEqual(['data_1']);
  });
});

describe('areContentImagesReady', () => {
  it('is ready when the page has no image contents', () => {
    expect(
      areContentImagesReady({
        contents: [textContent(1), imageContent('data_1', 2)],
        statuses: statuses({}),
        requestedDataContentIds: ALL_REQUESTED,
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(true);
  });

  it('is ready once every image on the page has loaded', () => {
    expect(
      areContentImagesReady({
        contents: [imageContent('data_1'), imageContent('data_2')],
        statuses: statuses({ data_1: 'loaded', data_2: 'loaded' }),
        requestedDataContentIds: ALL_REQUESTED,
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(true);
  });

  it('is not ready while an image on the page is loading', () => {
    expect(
      areContentImagesReady({
        contents: [imageContent('data_1'), imageContent('data_2')],
        statuses: statuses({ data_1: 'loaded', data_2: 'loading' }),
        requestedDataContentIds: ALL_REQUESTED,
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(false);
  });

  it('is not ready while an image on the page has no status yet', () => {
    expect(
      areContentImagesReady({
        contents: [imageContent('data_1')],
        statuses: statuses({}),
        requestedDataContentIds: ALL_REQUESTED,
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(false);
  });

  // Sealed envelopes have their contents imprinted on the PDF, so their
  // images are never requested. Waiting for a status which is never coming
  // would leave the page unrendered forever.
  it('is ready when an image on the page was never requested', () => {
    expect(
      areContentImagesReady({
        contents: [imageContent('data_1')],
        statuses: statuses({}),
        requestedDataContentIds: new Set<string>(),
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(true);
  });

  it('still waits for a requested image which has no status yet', () => {
    expect(
      areContentImagesReady({
        contents: [imageContent('data_1')],
        statuses: statuses({}),
        requestedDataContentIds: new Set(['data_1']),
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(false);
  });

  it('is ready when an image on the page has failed, since failure is terminal', () => {
    expect(
      areContentImagesReady({
        contents: [imageContent('data_1')],
        statuses: statuses({ data_1: 'failed' }),
        requestedDataContentIds: ALL_REQUESTED,
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(true);
  });

  it('ignores images on other pages and other items', () => {
    expect(
      areContentImagesReady({
        contents: [imageContent('data_1', 1), imageContent('data_2', 2), imageContent('data_3', 1, 'other')],
        statuses: statuses({ data_1: 'loaded' }),
        requestedDataContentIds: ALL_REQUESTED,
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(true);
  });
});

describe('hasFailedContentImage', () => {
  it('is true when an image on the page has failed', () => {
    expect(
      hasFailedContentImage({
        contents: [imageContent('data_1'), imageContent('data_2')],
        statuses: statuses({ data_1: 'loaded', data_2: 'failed' }),
        requestedDataContentIds: ALL_REQUESTED,
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(true);
  });

  it('is false when the failed image is on another page', () => {
    expect(
      hasFailedContentImage({
        contents: [imageContent('data_1', 1), imageContent('data_2', 2)],
        statuses: statuses({ data_1: 'loaded', data_2: 'failed' }),
        requestedDataContentIds: ALL_REQUESTED,
        pageNumber: 1,
        envelopeItemId: ITEM,
      }),
    ).toBe(false);
  });
});
