import { describe, expect, it } from 'vitest';

import { ContentShapeType, EnvelopeContentType, ZEnvelopeContentMetaSchema } from '../types/envelope-content-meta';
import { diffContentChanges } from './document-audit-logs';

const text = (overrides: Record<string, unknown> = {}, dataContentId: string | null = null) => ({
  metadata: ZEnvelopeContentMetaSchema.parse({
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

const line = (overrides: Record<string, unknown> = {}) => ({
  metadata: ZEnvelopeContentMetaSchema.parse({
    type: EnvelopeContentType.LINE,
    page: 1,
    startXPosition: 10,
    startYPosition: 20,
    endXPosition: 40,
    endYPosition: 60,
    ...overrides,
  }),
  dataContentId: null,
});

const image = (dataContentId: string | null) => ({
  metadata: ZEnvelopeContentMetaSchema.parse({
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

  it('reports a moved content', () => {
    expect(diffContentChanges(text(), text({ positionX: 55 }))).toEqual([
      { type: 'PROPERTY', key: 'positionX', from: 10, to: 55 },
    ]);
  });

  it('reports a content moved to another page', () => {
    expect(diffContentChanges(text(), text({ page: 3 }))).toEqual([{ type: 'PROPERTY', key: 'page', from: 1, to: 3 }]);
  });

  it('reports a resized content', () => {
    expect(diffContentChanges(text(), text({ width: 35, height: 45 }))).toEqual([
      { type: 'PROPERTY', key: 'height', from: 40, to: 45 },
      { type: 'PROPERTY', key: 'width', from: 30, to: 35 },
    ]);
  });

  it('reports the edited text', () => {
    expect(diffContentChanges(text(), text({ text: 'Rejected' }))).toEqual([
      { type: 'PROPERTY', key: 'text', from: 'Approved', to: 'Rejected' },
    ]);
  });

  it('reports a recoloured content', () => {
    expect(diffContentChanges(text(), text({ color: '#ff0000' }))).toEqual([
      { type: 'PROPERTY', key: 'color', from: '#000000', to: '#ff0000' },
    ]);
  });

  it('reports a rotated content', () => {
    expect(diffContentChanges(text(), text({ rotation: 90 }))).toEqual([
      { type: 'PROPERTY', key: 'rotation', from: 0, to: 90 },
    ]);
  });

  it('reports a replaced image', () => {
    expect(diffContentChanges(image('data_one'), image('data_two'))).toEqual([
      { type: 'PROPERTY', key: 'dataContentId', from: 'data_one', to: 'data_two' },
    ]);
  });

  it('reports an attached image', () => {
    expect(diffContentChanges(image(null), image('data_one'))).toEqual([
      { type: 'PROPERTY', key: 'dataContentId', from: null, to: 'data_one' },
    ]);
  });

  it('reports a changed content type', () => {
    const shape = {
      metadata: ZEnvelopeContentMetaSchema.parse({
        type: EnvelopeContentType.SHAPE,
        shape: ContentShapeType.RECTANGLE,
        page: 1,
        positionX: 10,
        positionY: 20,
        width: 30,
        height: 40,
      }),
      dataContentId: null,
    };

    expect(diffContentChanges(text(), shape)).toContainEqual({
      type: 'PROPERTY',
      key: 'type',
      from: EnvelopeContentType.TEXT,
      to: EnvelopeContentType.SHAPE,
    });
  });

  it('reports a property which was removed as cleared', () => {
    const withoutColour = text();

    delete (withoutColour.metadata as Record<string, unknown>).color;

    expect(diffContentChanges(text(), withoutColour)).toEqual([
      { type: 'PROPERTY', key: 'color', from: '#000000', to: null },
    ]);
  });

  it('reports every change in a stable order', () => {
    expect(diffContentChanges(text(), text({ positionY: 25, height: 45, text: 'Rejected' }))).toEqual([
      { type: 'PROPERTY', key: 'height', from: 40, to: 45 },
      { type: 'PROPERTY', key: 'positionY', from: 20, to: 25 },
      { type: 'PROPERTY', key: 'text', from: 'Approved', to: 'Rejected' },
    ]);
  });

  it('reports the endpoint of a line which was dragged', () => {
    expect(diffContentChanges(line(), line({ endYPosition: 80 }))).toEqual([
      { type: 'PROPERTY', key: 'endYPosition', from: 60, to: 80 },
    ]);
  });

  it('reports both endpoints of a line which was moved', () => {
    expect(diffContentChanges(line(), line({ startXPosition: 5, endXPosition: 35 }))).toEqual([
      { type: 'PROPERTY', key: 'endXPosition', from: 40, to: 35 },
      { type: 'PROPERTY', key: 'startXPosition', from: 10, to: 5 },
    ]);
  });

  it('reports nothing for a content whose optional values are all unset', () => {
    const bare = {
      metadata: ZEnvelopeContentMetaSchema.parse({ type: EnvelopeContentType.TEXT }),
      dataContentId: null,
    };

    expect(diffContentChanges(bare, bare)).toEqual([]);
  });
});
