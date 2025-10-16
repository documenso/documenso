import Konva from 'konva';
import { match } from 'ts-pattern';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { TRadioFieldMeta } from '../../types/field-meta';
import { upsertFieldGroup, upsertFieldRect } from './field-generic-items';
import { calculateFieldPosition, calculateMultiItemPosition } from './field-renderer';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';

// Do not change any of these values without consulting with the team.
const radioFieldPadding = 8;
const radioSize = 16;
const spacingBetweenRadioAndText = 8;

export const renderRadioFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { pageWidth, pageHeight, pageLayer, mode } = options;

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  const fieldGroup = upsertFieldGroup(field, options);

  // Clear previous children to re-render fresh
  fieldGroup.removeChildren();

  fieldGroup.add(upsertFieldRect(field, options));

  const radioMeta: TRadioFieldMeta | null = (field.fieldMeta as TRadioFieldMeta) || null;
  const radioValues = radioMeta?.values || [];

  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  fieldGroup.off('transform');

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
          itemSize: radioSize,
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
      .with('sign', () => value === field.customText)
      .with('export', () => value === field.customText)
      .exhaustive();

    const { itemInputX, itemInputY, textX, textY, textWidth, textHeight } =
      calculateMultiItemPosition({
        fieldWidth,
        fieldHeight,
        itemCount: radioValues.length,
        itemIndex: index,
        itemSize: radioSize,
        spacingBetweenItemAndText: spacingBetweenRadioAndText,
        fieldPadding: radioFieldPadding,
        type: 'radio',
        direction: radioMeta?.direction || 'vertical',
      });

    // Circle which represents the radio button.
    const circle = new Konva.Circle({
      internalRadioValue: value,
      id: `radio-circle-${index}`,
      name: 'radio-circle',
      x: itemInputX,
      y: itemInputY,
      radius: radioSize / 2,
      stroke: '#374151',
      strokeWidth: 2,
      fill: 'white',
    });

    // Dot which represents the selected state.
    const dot = new Konva.Circle({
      internalRadioValue: value,
      id: `radio-dot-${index}`,
      name: 'radio-dot',
      x: itemInputX,
      y: itemInputY,
      radius: radioSize / 4,
      fill: '#111827',
      visible: isRadioValueChecked,
    });

    const text = new Konva.Text({
      internalRadioValue: value,
      id: `radio-text-${index}`,
      name: 'radio-text',
      x: textX,
      y: textY,
      text: value,
      width: textWidth,
      height: textHeight,
      fontSize: DEFAULT_STANDARD_FONT_SIZE,
      fontFamily: 'Inter, system-ui, sans-serif',
      verticalAlign: 'middle',
      fill: '#111827', // Todo: Envelopes - Sort colours
    });

    fieldGroup.add(circle);
    fieldGroup.add(dot);
    fieldGroup.add(text);
  });

  return {
    fieldGroup,
    isFirstRender,
  };
};
