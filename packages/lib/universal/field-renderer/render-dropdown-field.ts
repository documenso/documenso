import Konva from 'konva';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { TDropdownFieldMeta } from '../../types/field-meta';
import {
  konvaTextFill,
  konvaTextFontFamily,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import { calculateFieldPosition } from './field-renderer';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';

type CalculateDropdownPositionOptions = {
  fieldWidth: number;
  fieldHeight: number;
};

/**
 * Calculate the position of a field item such as Checkbox, Radio.
 */
const calculateDropdownPosition = (options: CalculateDropdownPositionOptions) => {
  const { fieldWidth, fieldHeight } = options;

  const fieldPadding = 8;
  const arrowSize = 12;

  const textHeight = fieldHeight - fieldPadding * 2;
  const textWidth = fieldWidth - fieldPadding * 2;
  const textX = fieldPadding;
  const textY = fieldPadding;

  const arrowX = fieldWidth - arrowSize - fieldPadding;
  const arrowY = fieldHeight / 2 - arrowSize / 4;

  return {
    arrowX,
    arrowY,
    arrowSize,
    textX,
    textY,
    textWidth,
    textHeight,
  };
};

export const renderDropdownFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { pageWidth, pageHeight, pageLayer, mode } = options;

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  const fieldGroup = upsertFieldGroup(field, options);

  // Clear previous children to re-render fresh.
  fieldGroup.removeChildren();

  fieldGroup.add(upsertFieldRect(field, options));

  if (isFirstRender) {
    pageLayer.add(fieldGroup);

    fieldGroup.on('transform', () => {
      const groupScaleX = fieldGroup.scaleX();
      const groupScaleY = fieldGroup.scaleY();

      const fieldRect = fieldGroup.findOne('.field-rect');
      const text = fieldGroup.findOne('.dropdown-selected-text');
      const arrow = fieldGroup.findOne('.dropdown-arrow');

      if (!fieldRect || !text || !arrow) {
        console.log('fieldRect or text or arrow not found');
        return;
      }

      const rectWidth = fieldRect.width() * groupScaleX;
      const rectHeight = fieldRect.height() * groupScaleY;

      const { arrowX, arrowY, textX, textY, textWidth, textHeight } = calculateDropdownPosition({
        fieldWidth: rectWidth,
        fieldHeight: rectHeight,
      });

      arrow.setAttrs({
        x: arrowX,
        y: arrowY,
        scaleX: 1,
        scaleY: 1,
      });

      text.setAttrs({
        scaleX: 1,
        scaleY: 1,
        x: textX,
        y: textY,
        width: textWidth,
        height: textHeight,
      });

      fieldRect.setAttrs({
        width: rectWidth,
        height: rectHeight,
      });

      fieldGroup.scale({
        x: 1,
        y: 1,
      });

      pageLayer.batchDraw();
    });
  }

  const dropdownMeta: TDropdownFieldMeta | null = (field.fieldMeta as TDropdownFieldMeta) || null;
  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const fontSize = dropdownMeta?.fontSize || DEFAULT_STANDARD_FONT_SIZE;

  // Todo: Envelopes - Translations
  let selectedValue = 'Select Option';

  if (field.inserted) {
    selectedValue = field.customText;
  }

  const { arrowX, arrowY, arrowSize, textX, textY, textWidth, textHeight } =
    calculateDropdownPosition({
      fieldWidth,
      fieldHeight,
    });

  // Selected value text
  const selectedText = new Konva.Text({
    name: 'dropdown-selected-text',
    x: textX,
    y: textY,
    width: textWidth,
    height: textHeight,
    text: selectedValue,
    fontSize,
    fontFamily: konvaTextFontFamily,
    fill: konvaTextFill,
    verticalAlign: 'middle',
  });

  const arrow = new Konva.Line({
    name: 'dropdown-arrow',
    x: arrowX,
    y: arrowY,
    points: [0, 0, arrowSize / 2, arrowSize / 2, arrowSize, 0],
    stroke: '#6B7280',
    strokeWidth: 2,
    lineCap: 'round',
    lineJoin: 'round',
    closed: false,
    visible: mode !== 'export',
  });

  // Add hover state for dropdown
  fieldGroup.on('mouseenter', () => {
    // dropdownContainer.stroke('#2563EB');
    // dropdownContainer.strokeWidth(2);
    document.body.style.cursor = 'pointer';
    pageLayer.batchDraw();
  });

  fieldGroup.on('mouseleave', () => {
    // dropdownContainer.stroke('#374151');
    // dropdownContainer.strokeWidth(2);
    document.body.style.cursor = 'default';
    pageLayer.batchDraw();
  });

  fieldGroup.add(selectedText);

  if (!field.inserted || mode === 'export') {
    fieldGroup.add(arrow);
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
