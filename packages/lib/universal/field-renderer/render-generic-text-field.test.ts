import '../../server-only/konva/skia-backend';

import { FieldType } from '@prisma/client';
import Konva from 'konva';
import { describe, expect, it } from 'vitest';

import { getGenericTextFieldRenderStyle, renderGenericTextFieldElement } from './render-generic-text-field';

describe('getGenericTextFieldRenderStyle', () => {
  it('uses native Konva text styles outside of PDF export mode', () => {
    expect(
      getGenericTextFieldRenderStyle(
        {
          type: 'text',
          fontWeight: 'bold',
          fontStyle: 'italic',
        },
        'sign',
      ),
    ).toEqual({
      fontStyle: 'bold italic',
      skewX: 0,
      syntheticBoldOffsets: [],
    });
  });

  it('synthesizes bold and italic styles for PDF export mode', () => {
    const style = getGenericTextFieldRenderStyle(
      {
        type: 'text',
        fontWeight: 'bold',
        fontStyle: 'italic',
      },
      'export',
    );

    expect(style.fontStyle).toBe('normal');
    expect(style.skewX).not.toBe(0);
    expect(style.syntheticBoldOffsets.length).toBeGreaterThan(0);
  });

  it('renders synthetic export text nodes for bold italic PDF output', () => {
    const layer = new Konva.Layer();

    renderGenericTextFieldElement(
      {
        renderId: 'styled-text',
        envelopeItemId: 'envelope-item-1',
        recipientId: 1,
        type: FieldType.TEXT,
        page: 1,
        customText: 'Styled final text',
        inserted: true,
        width: 40,
        height: 10,
        positionX: 10,
        positionY: 10,
        fieldMeta: {
          type: 'text',
          fontWeight: 'bold',
          fontStyle: 'italic',
        },
      },
      {
        pageLayer: layer,
        pageWidth: 400,
        pageHeight: 400,
        mode: 'export',
        scale: 1,
        translations: null,
      },
    );

    const group = layer.findOne('#styled-text');
    const textNodes = group?.find((node) => node.getClassName() === 'Text') ?? [];

    expect(textNodes).toHaveLength(3);
    expect(textNodes.every((node) => node.skewX() !== 0)).toBe(true);
  });
});
