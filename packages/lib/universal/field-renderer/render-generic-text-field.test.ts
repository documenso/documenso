// ABOUTME: Unit tests for renderGenericTextFieldElement export-mode rendering of inserted values.
// ABOUTME: Guards against Konva clipping field text that overflows the field box (FS-162157).
import { FieldType } from '@prisma/client';
import type Konva from 'konva';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { FieldToRender } from './render-field';

// Letter-size page in PDF points, matching the sealed-PDF overlay dimensions.
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let KonvaNode: typeof import('konva').default;
let renderGenericTextFieldElement: typeof import('./render-generic-text-field').renderGenericTextFieldElement;

let stage: Konva.Stage | null = null;
let layer: Konva.Layer | null = null;

beforeAll(async () => {
  // Wire the skia-canvas backend before Konva measures any text, same as insert-field-in-pdf-v2.
  await import('../../server-only/konva/skia-backend');

  KonvaNode = (await import('konva')).default;

  ({ renderGenericTextFieldElement } = await import('./render-generic-text-field'));
});

afterEach(() => {
  stage?.destroy();
  layer?.destroy();
  stage = null;
  layer = null;
});

type InsertedFieldOverrides = Partial<FieldToRender> & Pick<FieldToRender, 'customText'>;

const renderInsertedField = (overrides: InsertedFieldOverrides) => {
  stage = new KonvaNode.Stage({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  layer = new KonvaNode.Layer();
  stage.add(layer);

  const field: FieldToRender = {
    renderId: 'test-field',
    envelopeItemId: 'envelope_item_test',
    recipientId: 1,
    type: FieldType.NAME,
    page: 1,
    inserted: true,
    width: 11.2756,
    height: 2.9052,
    positionX: 30,
    positionY: 20,
    fieldMeta: { type: 'name', fontSize: 12, showLine: false, textAlign: 'left' },
    signature: null,
    ...overrides,
  };

  renderGenericTextFieldElement(field, {
    pageLayer: layer,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    translations: null,
    mode: 'export',
    scale: 1,
  });

  const fieldText = layer.findOne<Konva.Text>(`#${field.renderId}-text`);

  if (!fieldText) {
    throw new Error('Field text node was not rendered');
  }

  return fieldText;
};

/**
 * The lines Konva will actually paint. Lines that do not fit within the
 * configured height are dropped from `textArr`, which is exactly the
 * truncation observed on sealed PDFs.
 */
const renderedText = (fieldText: Konva.Text) =>
  fieldText.textArr
    .map((line) => line.text)
    .join(' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

describe('renderGenericTextFieldElement – export mode overflow (FS-162157)', () => {
  it('renders a full name that is wider than the field box', () => {
    // Real dimensions from envelope_vtmyscmctonwvrfh field 44386: a NAME field
    // 69pt wide and 23pt tall whose sealed output showed only "Amanda".
    const fieldText = renderInsertedField({ customText: 'Amanda Haydon' });

    expect(renderedText(fieldText)).toBe('Amanda Haydon');
  });

  it('renders a full date-time that is wider than the field box', () => {
    // Real dimensions from field 44388: sealed output dropped the trailing "PM".
    const fieldText = renderInsertedField({
      type: FieldType.DATE,
      width: 18.1506,
      customText: '2026-07-06 04:45 PM',
      fieldMeta: { type: 'date', fontSize: 12, showLine: false, textAlign: 'left' },
    });

    expect(renderedText(fieldText)).toBe('2026-07-06 04:45 PM');
  });

  it('keeps the rendered text within the field box height', () => {
    const fieldText = renderInsertedField({ customText: 'Amanda Haydon' });

    const fieldHeight = PAGE_HEIGHT * (2.9052 / 100);
    const renderedHeight = fieldText.textArr.length * fieldText.fontSize() * fieldText.lineHeight();

    expect(renderedText(fieldText)).toBe('Amanda Haydon');
    expect(renderedHeight).toBeLessThanOrEqual(fieldHeight + 0.5);
  });

  it('keeps the configured font size when the text already fits', () => {
    const fieldText = renderInsertedField({
      width: 40,
      customText: 'Amanda Haydon',
    });

    expect(fieldText.fontSize()).toBe(12);
    expect(renderedText(fieldText)).toBe('Amanda Haydon');
  });
});
