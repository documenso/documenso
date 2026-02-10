import Konva from 'konva';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { GenericTextFieldTypeMetas } from '../../types/field-meta';
import {
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
  FIELD_DEFAULT_LETTER_SPACING,
  FIELD_DEFAULT_LINE_HEIGHT,
} from '../../types/field-meta';
import {
  createFieldHoverInteraction,
  konvaTextFill,
  konvaTextFontFamily,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

const DEFAULT_TEXT_X_PADDING = 6;

const upsertFieldText = (field: FieldToRender, options: RenderFieldElementOptions): Konva.Text => {
  const { pageWidth, pageHeight, mode = 'edit', pageLayer, translations } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const fieldMeta = field.fieldMeta as GenericTextFieldTypeMetas | undefined;

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
  const textFontSize = fieldMeta?.fontSize || DEFAULT_STANDARD_FONT_SIZE;

  // By default, render the field name or label centered
  let textToRender: string = fieldMeta?.label || fieldTypeName;
  let textAlign: 'left' | 'center' | 'right' = 'center';
  let textVerticalAlign: 'top' | 'middle' | 'bottom' = FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN;
  let textLineHeight = FIELD_DEFAULT_LINE_HEIGHT;
  let textLetterSpacing = FIELD_DEFAULT_LETTER_SPACING;

  // Render default values for text/number if provided for editing mode.
  if (mode === 'edit' && (fieldMeta?.type === 'text' || fieldMeta?.type === 'number')) {
    const value = fieldMeta?.type === 'text' ? fieldMeta.text : fieldMeta.value;

    if (value) {
      textToRender = value;

      textVerticalAlign = fieldMeta.verticalAlign || FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN;
      textAlign = fieldMeta.textAlign || FIELD_DEFAULT_GENERIC_ALIGN;
      textLetterSpacing = fieldMeta.letterSpacing || FIELD_DEFAULT_LETTER_SPACING;
      textLineHeight = fieldMeta.lineHeight || FIELD_DEFAULT_LINE_HEIGHT;
    }
  }

  // Default to blank for export mode since we want to ensure we don't show
  // any placeholder text or labels unless actually it's inserted.
  if (mode === 'export') {
    textToRender = '';
  }

  // Fallback render readonly fields if prefilled value exists.
  if (field?.fieldMeta?.readOnly && (fieldMeta?.type === 'text' || fieldMeta?.type === 'number')) {
    const value = fieldMeta?.type === 'text' ? fieldMeta.text : fieldMeta.value;

    if (value) {
      textToRender = value;

      textVerticalAlign = fieldMeta.verticalAlign || FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN;
      textAlign = fieldMeta.textAlign || FIELD_DEFAULT_GENERIC_ALIGN;
      textLetterSpacing = fieldMeta.letterSpacing || FIELD_DEFAULT_LETTER_SPACING;
      textLineHeight = fieldMeta.lineHeight || FIELD_DEFAULT_LINE_HEIGHT;
    }
  }

  // Override everything with value if it's inserted.
  if (field.inserted) {
    textToRender = field.customText;

    textAlign = fieldMeta?.textAlign || FIELD_DEFAULT_GENERIC_ALIGN;

    if (fieldMeta?.type === 'text' || fieldMeta?.type === 'number') {
      textVerticalAlign = fieldMeta.verticalAlign || FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN;
      textLetterSpacing = fieldMeta.letterSpacing || FIELD_DEFAULT_LETTER_SPACING;
      textLineHeight = fieldMeta.lineHeight || FIELD_DEFAULT_LINE_HEIGHT;
    }
  }

  // Note: Do not use native text padding since it's uniform.
  // We only want to have padding on the left and right hand sides.
  fieldText.setAttrs({
    x: textX + DEFAULT_TEXT_X_PADDING,
    y: textY,
    verticalAlign: textVerticalAlign,
    wrap: 'word',
    text: textToRender,
    fontSize: textFontSize,
    align: textAlign,
    lineHeight: textLineHeight,
    letterSpacing: textLetterSpacing,
    fontFamily: konvaTextFontFamily,
    fill: konvaTextFill,
    width: fieldWidth - DEFAULT_TEXT_X_PADDING * 2,
    height: fieldHeight,
  } satisfies Partial<Konva.TextConfig>);

  return fieldText;
};

export const renderGenericTextFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { mode = 'edit', pageLayer, color } = options;

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
    fieldText.width(rectWidth - DEFAULT_TEXT_X_PADDING * 2);
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
    fieldText.width(rectWidth - DEFAULT_TEXT_X_PADDING * 2);
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

  if (color !== 'readOnly' && mode !== 'export') {
    createFieldHoverInteraction({ fieldGroup, fieldRect, options });
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
