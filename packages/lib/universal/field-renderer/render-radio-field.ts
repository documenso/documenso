// ABOUTME: Konva renderer for radio field elements on the PDF canvas.
// ABOUTME: Supports vertical, horizontal, and custom drag-positioned layouts.
import Konva from 'konva';
import { match } from 'ts-pattern';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { TRadioFieldMeta } from '../../types/field-meta';
import { type OnItemDragEnd, setupItemDrag } from './field-drag-utils';
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
const radioFieldPadding = 8;
const spacingBetweenRadioAndText = 8;

const calculateRadioSize = (fontSize: number) => {
  return fontSize;
};

export const renderRadioFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
  onItemDragEnd?: OnItemDragEnd,
) => {
  const { pageWidth, pageHeight, pageLayer, mode, color } = options;

  const radioMeta: TRadioFieldMeta | null =
    field.fieldMeta?.type === 'radio' ? field.fieldMeta : null;
  const radioValues = radioMeta?.values || [];

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  // Clear previous children and listeners to re-render fresh
  const fieldGroup = upsertFieldGroup(field, options);
  fieldGroup.removeChildren();
  fieldGroup.off('transform');

  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  const fieldRect = upsertFieldRect(field, options);
  fieldGroup.add(fieldRect);

  const fontSize = radioMeta?.fontSize || DEFAULT_STANDARD_FONT_SIZE;

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

    const itemGroups = fieldGroup
      .find<Konva.Group>('.radio-item')
      .sort((a, b) => a.id().localeCompare(b.id(), undefined, { numeric: true }));

    itemGroups.forEach((itemGroup, i) => {
      const radioValue = radioValues[i];

      const { itemInputX, itemInputY, textX, textY, textWidth, textHeight } =
        calculateMultiItemPosition({
          fieldWidth: rectWidth,
          fieldHeight: rectHeight,
          itemCount: radioValues.length,
          itemIndex: i,
          itemSize: calculateRadioSize(fontSize),
          spacingBetweenItemAndText: spacingBetweenRadioAndText,
          fieldPadding: radioFieldPadding,
          type: 'radio',
          direction: radioMeta?.direction || 'vertical',
          item: radioValue,
        });

      const circleElement = itemGroup.findOne('.radio-circle');
      const dotElement = itemGroup.findOne('.radio-dot');
      const textElement = itemGroup.findOne('.radio-text');

      circleElement?.setAttrs({
        x: itemInputX,
        y: itemInputY,
        scaleX: 1,
        scaleY: 1,
      });

      dotElement?.setAttrs({
        x: itemInputX,
        y: itemInputY,
        scaleX: 1,
        scaleY: 1,
      });

      textElement?.setAttrs({
        x: textX,
        y: textY,
        scaleX: 1,
        scaleY: 1,
        width: textWidth,
        height: textHeight,
      });
    });

    fieldRect.width(rectWidth);
    fieldRect.height(rectHeight);

    fieldGroup.scale({
      x: 1,
      y: 1,
    });

    pageLayer.batchDraw();
  });

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  radioValues.forEach((radioValue, index) => {
    const { value, checked } = radioValue;

    const isRadioValueChecked = match(mode)
      .with('edit', () => checked)
      .with('sign', () => index.toString() === field.customText)
      .with('export', () => {
        // If it's read-only, check the originally checked state.
        if (radioMeta?.readOnly) {
          return checked;
        }

        return index.toString() === field.customText;
      })
      .exhaustive();

    const { itemInputX, itemInputY, textX, textY, textWidth, textHeight } =
      calculateMultiItemPosition({
        fieldWidth,
        fieldHeight,
        itemCount: radioValues.length,
        itemIndex: index,
        itemSize: calculateRadioSize(fontSize),
        spacingBetweenItemAndText: spacingBetweenRadioAndText,
        fieldPadding: radioFieldPadding,
        type: 'radio',
        direction: radioMeta?.direction || 'vertical',
        item: radioValue,
      });

    // Wrap each item's elements in a named group to support individual drag.
    const itemGroup = new Konva.Group({
      id: `radio-item-${index}`,
      name: 'radio-item',
    });

    // Circle which represents the radio button.
    const circle = new Konva.Circle({
      internalRadioIndex: index,
      id: `radio-circle-${index}`,
      name: 'radio-circle',
      x: itemInputX,
      y: itemInputY,
      radius: calculateRadioSize(fontSize) / 2,
      stroke: '#374151',
      strokeWidth: 1.5,
      fill: 'white',
    });

    // Dot which represents the selected state.
    const dot = new Konva.Circle({
      internalRadioIndex: index,
      id: `radio-dot-${index}`,
      name: 'radio-dot',
      x: itemInputX,
      y: itemInputY,
      radius: calculateRadioSize(fontSize) / 4,
      fill: '#111827',
      visible: isRadioValueChecked,
    });

    const text = new Konva.Text({
      internalRadioIndex: index,
      id: `radio-text-${index}`,
      name: 'radio-text',
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

    itemGroup.add(circle);
    itemGroup.add(dot);
    itemGroup.add(text);

    if (mode === 'edit' && radioMeta?.direction === 'custom' && onItemDragEnd) {
      const radioSize = calculateRadioSize(fontSize);
      const radioRadius = radioSize / 2;
      const currentOX = radioValue.offsetX ?? 0;
      const currentOY = radioValue.offsetY ?? 0;
      const baseX = itemInputX - currentOX;
      const baseY = itemInputY - currentOY;

      setupItemDrag({
        itemGroup,
        index,
        currentOffsetX: currentOX,
        currentOffsetY: currentOY,
        clampOffset: (rawOffsetX, rawOffsetY) => ({
          offsetX: Math.max(
            -(baseX - radioRadius),
            Math.min(fieldWidth - baseX - radioRadius, rawOffsetX),
          ),
          offsetY: Math.max(
            -(baseY - radioRadius),
            Math.min(fieldHeight - baseY - radioRadius, rawOffsetY),
          ),
        }),
        onItemDragEnd,
      });
    }

    fieldGroup.add(itemGroup);
  });

  if (radioMeta?.direction === 'custom' && radioValues.length > 0) {
    const clientRect = fieldGroup.getClientRect({ relativeTo: fieldGroup });
    fieldRect.setAttrs({
      x: clientRect.x,
      y: clientRect.y,
      width: clientRect.width,
      height: clientRect.height,
    });
  }

  if (color !== 'readOnly' && mode !== 'export') {
    createFieldHoverInteraction({ fieldGroup, fieldRect, options, field });
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
