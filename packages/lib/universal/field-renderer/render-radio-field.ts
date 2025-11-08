import Konva from 'konva';
import { match } from 'ts-pattern';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { TRadioFieldMeta } from '../../types/field-meta';
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
) => {
  const { pageWidth, pageHeight, pageLayer, mode, color } = options;

  const radioMeta: TRadioFieldMeta | null = (field.fieldMeta as TRadioFieldMeta) || null;
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

    const circles = fieldGroup.find('.radio-circle').sort((a, b) => a.id().localeCompare(b.id()));
    const checkmarks = fieldGroup.find('.radio-dot').sort((a, b) => a.id().localeCompare(b.id()));
    const text = fieldGroup.find('.radio-text').sort((a, b) => a.id().localeCompare(b.id()));

    const groupedItems = circles.map((circle, i) => ({
      circleElement: circle,
      checkmarkElement: checkmarks[i],
      textElement: text[i],
    }));

    groupedItems.forEach((item, i) => {
      const { circleElement, checkmarkElement, textElement } = item;

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
        });

      circleElement.setAttrs({
        x: itemInputX,
        y: itemInputY,
        scaleX: 1,
        scaleY: 1,
      });

      checkmarkElement.setAttrs({
        x: itemInputX,
        y: itemInputY,
        scaleX: 1,
        scaleY: 1,
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

    fieldRect.width(rectWidth);
    fieldRect.height(rectHeight);

    fieldGroup.scale({
      x: 1,
      y: 1,
    });

    pageLayer.batchDraw();
  });

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  radioValues.forEach(({ value, checked }, index) => {
    const isRadioValueChecked = match(mode)
      .with('edit', () => checked)
      .with('sign', () => index.toString() === field.customText)
      .with('export', () => {
        // If it's read-only, check the originally checked state.
        if (radioMeta.readOnly) {
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

    fieldGroup.add(circle);
    fieldGroup.add(dot);
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
