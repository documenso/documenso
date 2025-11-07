import Konva from 'konva';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { TTextFieldMeta } from '../../types/field-meta';
import {
  createFieldHoverInteraction,
  konvaTextFill,
  konvaTextFontFamily,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

const DEFAULT_TEXT_ALIGN = 'left';

const upsertFieldText = (field: FieldToRender, options: RenderFieldElementOptions): Konva.Text => {
  const { pageWidth, pageHeight, mode = 'edit', pageLayer, translations } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const textMeta = field.fieldMeta as TTextFieldMeta | undefined;

  const fieldTypeName = translations?.[field.type] || field.type;

  const fieldText: Konva.Text =
    pageLayer.findOne(`#${field.renderId}-text`) ||
    new Konva.Text({
      id: `${field.renderId}-text`,
      name: 'field-text',
    });

  // Calculate text positioning based on alignment
  const textX = 0;
  const textY = 0;
  let textAlign: 'left' | 'center' | 'right' = textMeta?.textAlign || DEFAULT_TEXT_ALIGN;
  const textVerticalAlign: 'top' | 'middle' | 'bottom' = 'middle';
  const textFontSize = textMeta?.fontSize || DEFAULT_STANDARD_FONT_SIZE;
  const textPadding = 10;

  let textToRender: string = fieldTypeName;

  // Handle edit mode.
  if (mode === 'edit') {
    if (textMeta?.text) {
      textToRender = textMeta.text;
    } else {
      // Show field name which is centered for the edit mode if no label/text is avaliable.
      textToRender = textMeta?.label || fieldTypeName;
      textAlign = 'center';
    }
  }

  // Handle sign mode.
  if (mode === 'sign' || mode === 'export') {
    if (!field.inserted) {
      if (textMeta?.text) {
        textToRender = textMeta.text;
      } else if (mode === 'sign') {
        // Only show the field name in sign mode if no text/label is avaliable.
        textToRender = textMeta?.label || fieldTypeName;
        textAlign = 'center';
      }
    }

    if (field.inserted) {
      textToRender = field.customText;
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
    fontFamily: konvaTextFontFamily,
    fill: konvaTextFill,
    align: textAlign,
    width: fieldWidth,
    height: fieldHeight,
  } satisfies Partial<Konva.TextConfig>);

  return fieldText;
};

export const renderGenericTextFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { mode = 'edit', pageLayer } = options;

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  // Clear previous children and listeners to re-render fresh.
  const fieldGroup = upsertFieldGroup(field, options);
  fieldGroup.removeChildren();
  fieldGroup.off('transform');

  // Assign elements to group and any listeners that should only be run on initialization.
  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  // Render the field background and text.
  const fieldRect = upsertFieldRect(field, options);
  const fieldText = upsertFieldText(field, options);

  fieldGroup.add(fieldRect);
  fieldGroup.add(fieldText);

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

    // Update text dimensions
    fieldText.width(rectWidth);
    fieldText.height(rectHeight);

    // Force Konva to recalculate text layout
    fieldText.height();

    fieldGroup.getLayer()?.batchDraw();
  });

  // Reset the text after transform has ended.
  fieldGroup.on('transformend', () => {
    fieldText.scaleX(1);
    fieldText.scaleY(1);

    const rectWidth = fieldRect.width();
    const rectHeight = fieldRect.height();

    // Update text dimensions
    fieldText.width(rectWidth); // Account for padding
    fieldText.height(rectHeight);

    // Force Konva to recalculate text layout
    fieldText.height();

    fieldGroup.getLayer()?.batchDraw();
  });

  // Handle export mode.
  if (mode === 'export') {
    // Hide the rectangle.
    fieldRect.opacity(0);
  }

  createFieldHoverInteraction({ fieldGroup, fieldRect, options });

  return {
    fieldGroup,
    isFirstRender,
  };
};
