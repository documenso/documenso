import { describe, expect, it } from 'vitest';

import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '../types/envelope-content-meta';
import { diffContentChanges } from './document-audit-logs';

const text = (overrides: Record<string, unknown> = {}, dataContentId: string | null = null) => ({
  contentMeta: ZEnvelopeContentMetaSchema.parse({
    type: EnvelopeContentType.TEXT,
    page: 1,
    positionX: 10,
    positionY: 20,
    width: 30,
    height: 40,
    text: 'Approved',
    color: '#000000',
    ...overrides,
  }),
  dataContentId,
});

const image = (dataContentId: string | null) => ({
  contentMeta: ZEnvelopeContentMetaSchema.parse({
    type: EnvelopeContentType.IMAGE,
    page: 1,
    positionX: 10,
    positionY: 20,
    width: 30,
    height: 40,
  }),
  dataContentId,
});

describe('diffContentChanges', () => {
  it('reports nothing when the content is unchanged', () => {
    expect(diffContentChanges(text(), text())).toEqual([]);
  });

  it('reports a changed property', () => {
    expect(diffContentChanges(text(), text({ text: 'Rejected' }))).toEqual([
      { type: 'PROPERTY', key: 'text', from: 'Approved', to: 'Rejected' },
    ]);
  });

  it('reports a property which was removed as cleared', () => {
    const withoutColour = text();

    delete (withoutColour.contentMeta as Record<string, unknown>).color;

    expect(diffContentChanges(text(), withoutColour)).toEqual([
      { type: 'PROPERTY', key: 'color', from: '#000000', to: null },
    ]);
  });

  /**
   * The attached image lives alongside the content meta rather than within it, so
   * it is diffed separately to every other property.
   */
  it('reports an attached image', () => {
    expect(diffContentChanges(image(null), image('data_one'))).toEqual([
      { type: 'PROPERTY', key: 'dataContentId', from: null, to: 'data_one' },
    ]);
  });

  it('reports every change in a stable order', () => {
    expect(diffContentChanges(text(), text({ positionY: 25, height: 45, text: 'Rejected' }))).toEqual([
      { type: 'PROPERTY', key: 'height', from: 40, to: 45 },
      { type: 'PROPERTY', key: 'positionY', from: 20, to: 25 },
      { type: 'PROPERTY', key: 'text', from: 'Approved', to: 'Rejected' },
    ]);
  });
});
