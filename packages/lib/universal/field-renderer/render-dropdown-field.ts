import { FieldType } from '@prisma/client';
import Konva from 'konva';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { TDropdownFieldMeta } from '../../types/field-meta';
import {
  createFieldHoverInteraction,
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
  const { pageWidth, pageHeight, pageLayer, mode, translations, color } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const dropdownMeta: TDropdownFieldMeta | null = (field.fieldMeta as TDropdownFieldMeta) || null;

  let selectedValue = translations?.[FieldType.DROPDOWN] || 'Select Option';

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  // Clear previous children to re-render fresh.
  const fieldGroup = upsertFieldGroup(field, options);
  fieldGroup.removeChildren();
  fieldGroup.off('transform');

  const fieldRect = upsertFieldRect(field, options);
  fieldGroup.add(fieldRect);

  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  const fontSize = dropdownMeta?.fontSize || DEFAULT_STANDARD_FONT_SIZE;

  // Don't show any labels when exporting.
  if (mode === 'export') {
    selectedValue = '';
  }

  // Render the default value if readonly.
  if (
    dropdownMeta?.readOnly &&
    dropdownMeta.defaultValue &&
    dropdownMeta.values &&
    dropdownMeta.values.some((value) => value.value === dropdownMeta.defaultValue)
  ) {
    selectedValue = dropdownMeta.defaultValue;
  }

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

  fieldGroup.add(selectedText);

  if (!field.inserted || mode === 'export') {
    fieldGroup.add(arrow);
  }

  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    const fieldRect = fieldGroup.findOne('.field-rect');
    const text = fieldGroup.findOne('.dropdown-selected-text');
    const arrow = fieldGroup.findOne('.dropdown-arrow');

    if (!fieldRect || !text || !arrow) {
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

  if (color !== 'readOnly' && mode !== 'export') {
    createFieldHoverInteraction({ fieldGroup, fieldRect, options });
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
