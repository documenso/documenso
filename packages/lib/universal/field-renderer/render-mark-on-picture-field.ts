import Konva from 'konva';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { TMarkOnPictureFieldMeta } from '../../types/field-meta';
import {
  createFieldHoverInteraction,
  konvaTextFill,
  konvaTextFontFamily,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

export const renderMarkOnPictureFieldElement = (field: FieldToRender, options: RenderFieldElementOptions) => {
  const { pageWidth, pageHeight, pageLayer, mode, color } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const markMeta: TMarkOnPictureFieldMeta | null = (field.fieldMeta as TMarkOnPictureFieldMeta) || null;
  const marks = markMeta?.marks || [];

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  // Clear previous children and listeners to re-render fresh.
  const fieldGroup = upsertFieldGroup(field, options);
  fieldGroup.removeChildren();
  fieldGroup.off('transform');

  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  const fieldRect = upsertFieldRect(field, options);
  fieldGroup.add(fieldRect);

  // Draw dashed border to indicate this is a mark-on-picture area
  const dashedBorder = new Konva.Rect({
    name: 'mark-border',
    x: 0,
    y: 0,
    width: fieldWidth,
    height: fieldHeight,
    stroke: '#6366f1',
    strokeWidth: 2,
    dash: [6, 4],
    cornerRadius: 4,
    fill: 'rgba(99, 102, 241, 0.05)',
  });
  fieldGroup.add(dashedBorder);

  // Add label text
  const fontSize = markMeta?.fontSize || DEFAULT_STANDARD_FONT_SIZE;
  const label = new Konva.Text({
    name: 'mark-label',
    x: 4,
    y: 4,
    text: 'Click to mark',
    fontSize: fontSize,
    fontFamily: konvaTextFontFamily,
    fill: '#6366f1',
    width: fieldWidth - 8,
    height: fieldHeight - 8,
    align: 'center',
    verticalAlign: 'middle',
  });
  fieldGroup.add(label);

  // Render existing marks as small circles with labels
  if (marks.length > 0 && fieldWidth > 0 && fieldHeight > 0) {
    marks.forEach((mark) => {
      const markX = (mark.x / 100) * fieldWidth;
      const markY = (mark.y / 100) * fieldHeight;

      const circle = new Konva.Circle({
        name: 'mark-point',
        x: markX,
        y: markY,
        radius: 6,
        fill: '#ef4444',
        stroke: '#ffffff',
        strokeWidth: 2,
      });
      fieldGroup.add(circle);

      if (mark.label) {
        const markLabel = new Konva.Text({
          name: 'mark-text',
          x: markX + 10,
          y: markY - 6,
          text: mark.label,
          fontSize: 10,
          fontFamily: konvaTextFontFamily,
          fill: '#ef4444',
        });
        fieldGroup.add(markLabel);
      }
    });
  }

  // Handle rescaling during transforms
  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    const rect = fieldGroup.findOne('.field-rect');
    const border = fieldGroup.findOne('.mark-border');
    const lbl = fieldGroup.findOne('.mark-label');

    if (rect) {
      const rectWidth = rect.width() * groupScaleX;
      const rectHeight = rect.height() * groupScaleY;

      if (border) {
        border.setAttrs({
          width: rectWidth,
          height: rectHeight,
        });
      }

      if (lbl) {
        lbl.setAttrs({
          width: rectWidth - 8,
          height: rectHeight - 8,
        });
      }

      fieldGroup.scale({ x: 1, y: 1 });
      pageLayer.batchDraw();
    }
  });

  if (color !== 'readOnly' && mode !== 'export') {
    createFieldHoverInteraction({ fieldGroup, fieldRect, options });
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
