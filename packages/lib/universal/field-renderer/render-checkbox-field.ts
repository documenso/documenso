import Konva from 'konva';
import { match } from 'ts-pattern';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { TCheckboxFieldMeta } from '../../types/field-meta';
import { parseCheckboxCustomText } from '../../utils/fields';
import {
  createFieldHoverInteraction,
  konvaTextFill,
  konvaTextFontFamily,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import { calculateFieldPosition, calculateMultiItemPosition } from './field-renderer';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';

// Do not change any of these values without consulting with the team.
const checkboxFieldPadding = 8;
const spacingBetweenCheckboxAndText = 8;

const calculateCheckboxSize = (fontSize: number) => {
  return fontSize;
};

export const renderCheckboxFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { pageWidth, pageHeight, pageLayer, mode, color } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const checkboxMeta: TCheckboxFieldMeta | null = (field.fieldMeta as TCheckboxFieldMeta) || null;
  const checkboxValues = checkboxMeta?.values || [];

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

  const fontSize = checkboxMeta?.fontSize || DEFAULT_STANDARD_FONT_SIZE;

  // Handle rescaling items during transforms.
  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    const fieldRect = fieldGroup.findOne('.field-rect');

    if (!fieldRect) {
      return;
    }

    const rectWidth = fieldRect.width() * groupScaleX;
    const rectHeight = fieldRect.height() * groupScaleY;

    const squares = fieldGroup
      .find('.checkbox-square')
      .sort((a, b) => a.id().localeCompare(b.id(), undefined, { numeric: true }));
    const checkmarks = fieldGroup
      .find('.checkbox-checkmark')
      .sort((a, b) => a.id().localeCompare(b.id(), undefined, { numeric: true }));
    const text = fieldGroup
      .find('.checkbox-text')
      .sort((a, b) => a.id().localeCompare(b.id(), undefined, { numeric: true }));

    const groupedItems = squares.map((square, i) => ({
      squareElement: square,
      checkmarkElement: checkmarks[i],
      textElement: text[i],
    }));

    groupedItems.forEach((item, i) => {
      const { squareElement, checkmarkElement, textElement } = item;

      const { itemInputX, itemInputY, textX, textY, textWidth, textHeight } =
        calculateMultiItemPosition({
          fieldWidth: rectWidth,
          fieldHeight: rectHeight,
          itemCount: checkboxValues.length,
          itemIndex: i,
          itemSize: calculateCheckboxSize(fontSize),
          spacingBetweenItemAndText: spacingBetweenCheckboxAndText,
          fieldPadding: checkboxFieldPadding,
          direction: checkboxMeta?.direction || 'vertical',
          type: 'checkbox',
        });

      squareElement.setAttrs({
        x: itemInputX,
        y: itemInputY,
        scaleX: 1,
        scaleY: 1,
      });

      checkmarkElement.setAttrs({
        x: itemInputX,
        y: itemInputY,
      });

      textElement.setAttrs({
        x: textX,
        y: textY,
        scaleX: 1,
        scaleY: 1,
        width: textWidth,
        height: textHeight,
      });
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

  const checkedValues: number[] = field.customText ? parseCheckboxCustomText(field.customText) : [];

  checkboxValues.forEach(({ value, checked }, index) => {
    const isCheckboxChecked = match(mode)
      .with('edit', () => checked)
      .with('sign', () => checkedValues.includes(index))
      .with('export', () => {
        // If it's read-only, check the originally checked state.
        if (checkboxMeta.readOnly) {
          return checked;
        }

        return checkedValues.includes(index);
      })
      .exhaustive();

    const itemSize = calculateCheckboxSize(fontSize);

    const { itemInputX, itemInputY, textX, textY, textWidth, textHeight } =
      calculateMultiItemPosition({
        fieldWidth,
        fieldHeight,
        itemCount: checkboxValues.length,
        itemIndex: index,
        itemSize,
        spacingBetweenItemAndText: spacingBetweenCheckboxAndText,
        fieldPadding: checkboxFieldPadding,
        direction: checkboxMeta?.direction || 'vertical',
        type: 'checkbox',
      });

    const square = new Konva.Rect({
      internalCheckboxIndex: index,
      id: `checkbox-square-${index}`,
      name: 'checkbox-square',
      x: itemInputX,
      y: itemInputY,
      width: itemSize,
      height: itemSize,
      stroke: '#374151',
      strokeWidth: 1.5,
      cornerRadius: 2,
      fill: 'white',
    });

    const checkboxScale = itemSize / 16;

    const checkmark = new Konva.Line({
      internalCheckboxIndex: index,
      id: `checkbox-checkmark-${index}`,
      name: 'checkbox-checkmark',
      x: itemInputX,
      y: itemInputY,
      strokeWidth: 2,
      stroke: '#111827',
      points: [3, 8, 7, 12, 13, 4],
      scale: { x: checkboxScale, y: checkboxScale },
      visible: isCheckboxChecked,
    });

    const text = new Konva.Text({
      internalCheckboxIndex: index,
      id: `checkbox-text-${index}`,
      name: 'checkbox-text',
      x: textX,
      y: textY,
      text: value,
      width: textWidth,
      height: textHeight,
      fontSize,
      fontFamily: konvaTextFontFamily,
      fill: konvaTextFill,
      verticalAlign: 'middle',
    });

    fieldGroup.add(square);
    fieldGroup.add(checkmark);
    fieldGroup.add(text);
  });

  if (color !== 'readOnly' && mode !== 'export') {
    createFieldHoverInteraction({ fieldGroup, fieldRect, options });
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
