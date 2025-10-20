import Konva from 'konva';

import {
  DEFAULT_RECT_BACKGROUND,
  RECIPIENT_COLOR_STYLES,
} from '@documenso/ui/lib/recipient-colors';

import {
  DEFAULT_HANDWRITING_FONT_SIZE,
  DEFAULT_STANDARD_FONT_SIZE,
  MIN_HANDWRITING_FONT_SIZE,
} from '../../constants/pdf';
import { AppError } from '../../errors/app-error';
import { upsertFieldGroup, upsertFieldRect } from './field-generic-items';
import { calculateFieldPosition } from './field-renderer';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';

const minFontSize = MIN_HANDWRITING_FONT_SIZE;
const maxFontSize = DEFAULT_HANDWRITING_FONT_SIZE;

const upsertFieldText = (field: FieldToRender, options: RenderFieldElementOptions): Konva.Text => {
  const { pageWidth, pageHeight, mode = 'edit', pageLayer } = options;

  console.log({
    pageWidth,
    pageHeight,
  });

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const fieldText: Konva.Text =
    pageLayer.findOne(`#${field.renderId}-text`) ||
    new Konva.Text({
      id: `${field.renderId}-text`,
      name: 'field-text',
    });

  // Calculate text positioning based on alignment
  const textX = 0;
  const textY = 0;
  const textAlign = 'center';
  let textVerticalAlign: 'top' | 'middle' | 'bottom' = 'top';
  let textFontSize = DEFAULT_STANDARD_FONT_SIZE;
  const textPadding = 10;

  let textToRender: string = field.type;

  const signature = field.signature;

  // Handle edit mode.
  if (mode === 'edit') {
    textToRender = field.type; // Todo: Envelope - Need translations
  }

  // Handle sign mode.
  if (mode === 'sign' || mode === 'export') {
    textToRender = field.type; // Todo: Envelope - Need translations
    textFontSize = DEFAULT_STANDARD_FONT_SIZE;
    textVerticalAlign = 'middle';

    if (field.inserted && !signature) {
      throw new AppError('MISSING_SIGNATURE');
    }

    if (signature?.typedSignature) {
      textToRender = signature.typedSignature;
    }
  }

  fieldText.setAttrs({
    x: textX,
    y: textY,
    verticalAlign: textVerticalAlign,
    wrap: 'word',
    padding: textPadding,

    text: textToRender,

    fontSize: textFontSize,
    fontFamily: 'Caveat, Inter', // Todo: Envelopes - Fix all fonts for sans
    align: textAlign,
    width: fieldWidth,
    height: fieldHeight,
  } satisfies Partial<Konva.TextConfig>);

  return fieldText;
};

export const renderSignatureFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { mode = 'edit', pageLayer } = options;

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  const fieldGroup = upsertFieldGroup(field, options);

  // ABOVE IS GENERIC, EXTRACT IT.

  // Render the field background and text.
  const fieldRect = upsertFieldRect(field, options);
  const fieldText = upsertFieldText(field, options);

  // Assign elements to group and any listeners that should only be run on initialization.
  if (isFirstRender) {
    fieldGroup.add(fieldRect);
    fieldGroup.add(fieldText);
    pageLayer.add(fieldGroup);

    // This is to keep the text inside the field at the same size
    // when the field is resized. Without this the text would be stretched.
    fieldGroup.on('transform', () => {
      const groupScaleX = fieldGroup.scaleX();
      const groupScaleY = fieldGroup.scaleY();

      // Adjust text scale so it doesn't change while group is resized.
      fieldText.scaleX(1 / groupScaleX);
      fieldText.scaleY(1 / groupScaleY);

      const rectWidth = fieldRect.width() * groupScaleX;
      const rectHeight = fieldRect.height() * groupScaleY;

      // // Update text group position and clipping
      // fieldGroup.clipFunc(function (ctx) {
      //   ctx.rect(0, 0, rectWidth, rectHeight);
      // });

      // Update text dimensions
      fieldText.width(rectWidth); // Account for padding
      fieldText.height(rectHeight);

      console.log({
        rectWidth,
      });

      // Force Konva to recalculate text layout
      // textInsideField.getTextHeight(); // This forces recalculation
      fieldText.height(); // This forces recalculation

      // fieldGroup.draw();
      fieldGroup.getLayer()?.batchDraw();
    });

    // Reset the text after transform has ended.
    fieldGroup.on('transformend', () => {
      fieldText.scaleX(1);
      fieldText.scaleY(1);

      const rectWidth = fieldRect.width();
      const rectHeight = fieldRect.height();

      // // Update text group position and clipping
      // fieldGroup.clipFunc(function (ctx) {
      //   ctx.rect(0, 0, rectWidth, rectHeight);
      // });

      // Update text dimensions
      fieldText.width(rectWidth); // Account for padding
      fieldText.height(rectHeight);

      // Force Konva to recalculate text layout
      // textInsideField.getTextHeight(); // This forces recalculation
      fieldText.height(); // This forces recalculation

      // fieldGroup.draw();
      fieldGroup.getLayer()?.batchDraw();
    });
  }

  // Handle export mode.
  if (mode === 'export') {
    // Hide the rectangle.
    fieldRect.opacity(0);
  }

  // Todo: Doesn't work.
  if (mode !== 'export') {
    const hoverColor = options.color
      ? RECIPIENT_COLOR_STYLES[options.color].baseRingHover
      : '#e5e7eb';

    // Todo: Envelopes - On hover add text color

    // Add smooth transition-like behavior for hover effects
    fieldGroup.on('mouseover', () => {
      new Konva.Tween({
        node: fieldRect,
        duration: 0.3,
        fill: hoverColor,
      }).play();
    });

    fieldGroup.on('mouseout', () => {
      new Konva.Tween({
        node: fieldRect,
        duration: 0.3,
        fill: DEFAULT_RECT_BACKGROUND,
      }).play();
    });

    fieldGroup.add(fieldRect);
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
