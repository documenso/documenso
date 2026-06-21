import Konva from 'konva';

import type { THighlightFieldMeta } from '../../types/field-meta';
import {
  createFieldHoverInteraction,
  konvaTextFontFamily,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

export const renderHighlightFieldElement = (field: FieldToRender, options: RenderFieldElementOptions) => {
  const { pageWidth, pageHeight, pageLayer, mode, color } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const highlightMeta: THighlightFieldMeta | null = (field.fieldMeta as THighlightFieldMeta) || null;
  const highlights = highlightMeta?.highlights || [];

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  const fieldGroup = upsertFieldGroup(field, options);
  fieldGroup.removeChildren();
  fieldGroup.off('transform');

  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  const fieldRect = upsertFieldRect(field, options);
  fieldGroup.add(fieldRect);

  if (highlights.length > 0) {
    highlights.forEach((highlight) => {
      highlight.bounds.forEach((bound) => {
        const boundX = (bound.x / 100) * fieldWidth;
        const boundY = (bound.y / 100) * fieldHeight;
        const boundWidth = (bound.width / 100) * fieldWidth;
        const boundHeight = (bound.height / 100) * fieldHeight;

        const highlightRect = new Konva.Rect({
          x: boundX,
          y: boundY,
          width: boundWidth,
          height: boundHeight,
          fill: highlight.color,
          opacity: 0.4,
          stroke: highlight.color,
          strokeWidth: 1,
          cornerRadius: 2,
        });
        fieldGroup.add(highlightRect);
      });
    });
  } else {
    const label = new Konva.Text({
      name: 'highlight-label',
      x: 4,
      y: fieldHeight / 2 - 10,
      text: 'Click to highlight text',
      fontSize: 14,
      fontFamily: konvaTextFontFamily,
      fill: '#eab308',
      width: fieldWidth - 8,
      height: 20,
      align: 'center',
      verticalAlign: 'middle',
    });
    fieldGroup.add(label);
  }

  if (color !== 'readOnly' && mode !== 'export') {
    createFieldHoverInteraction({ fieldGroup, fieldRect, options });
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};