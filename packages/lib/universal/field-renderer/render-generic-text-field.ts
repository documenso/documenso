import Konva from 'konva';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { GenericTextFieldTypeMetas } from '../../types/field-meta';
import {
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
  FIELD_DEFAULT_LETTER_SPACING,
  FIELD_DEFAULT_LINE_HEIGHT,
  resolveFieldOverflowMode,
} from '../../types/field-meta';
import { calculateOverflowLayout } from './calculate-overflow-layout';
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

const upsertFieldText = (field: FieldToRender, options: RenderFieldElementOptions) => {
  const { pageWidth, pageHeight, mode = 'edit', pageLayer, translations } = options;

  const { fieldX, fieldY, fieldWidth, fieldHeight } = calculateFieldPosition(
    field,
    pageWidth,
    pageHeight,
  );

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

  // By default, render the field name or label centered.
  // isLabel tracks whether we're rendering the field type name (like "Text", "Date", "Email")
  // or a user label — overflow should not apply to these, only to actual content.
  let isLabel = true;
  let textToRender: string = fieldMeta?.label || fieldTypeName;
  let textAlign: 'left' | 'center' | 'right' = 'center';
  let textVerticalAlign: 'top' | 'middle' | 'bottom' = FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN;
  let textLineHeight = FIELD_DEFAULT_LINE_HEIGHT;
  let textLetterSpacing = FIELD_DEFAULT_LETTER_SPACING;

  // Render default values for text/number if provided for editing mode.
  if (mode === 'edit' && (fieldMeta?.type === 'text' || fieldMeta?.type === 'number')) {
    const value = fieldMeta?.type === 'text' ? fieldMeta.text : fieldMeta.value;

    if (value) {
      isLabel = false;
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
      isLabel = false;
      textToRender = value;

      textVerticalAlign = fieldMeta.verticalAlign || FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN;
      textAlign = fieldMeta.textAlign || FIELD_DEFAULT_GENERIC_ALIGN;
      textLetterSpacing = fieldMeta.letterSpacing || FIELD_DEFAULT_LETTER_SPACING;
      textLineHeight = fieldMeta.lineHeight || FIELD_DEFAULT_LINE_HEIGHT;
    }
  }

  // Override everything with value if it's inserted.
  if (field.inserted) {
    isLabel = false;
    textToRender = field.customText;

    textAlign = fieldMeta?.textAlign || FIELD_DEFAULT_GENERIC_ALIGN;

    if (fieldMeta?.type === 'text' || fieldMeta?.type === 'number') {
      textVerticalAlign = fieldMeta.verticalAlign || FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN;
      textLetterSpacing = fieldMeta.letterSpacing || FIELD_DEFAULT_LETTER_SPACING;
      textLineHeight = fieldMeta.lineHeight || FIELD_DEFAULT_LINE_HEIGHT;
    }
  }

  const overflowLayout = calculateOverflowLayout({
    overflowMode: resolveFieldOverflowMode(fieldMeta),
    isLabel,
    textToRender,
    fontSize: textFontSize,
    fontFamily: konvaTextFontFamily,
    lineHeight: textLineHeight,
    letterSpacing: textLetterSpacing,
    textAlign,
    verticalAlign: textVerticalAlign,
    baseX: textX + DEFAULT_TEXT_X_PADDING,
    baseY: textY,
    baseWidth: fieldWidth - DEFAULT_TEXT_X_PADDING * 2,
    baseHeight: fieldHeight,
    groupX: fieldX,
    groupY: fieldY,
    pageWidth,
    pageHeight,
  });

  // Note: Do not use native text padding since it's uniform.
  // We only want to have padding on the left and right hand sides.
  fieldText.setAttrs({
    x: overflowLayout.x,
    y: overflowLayout.y,
    verticalAlign: overflowLayout.verticalAlign,
    wrap: overflowLayout.wrap,
    text: textToRender,
    fontSize: textFontSize,
    align: overflowLayout.textAlign,
    lineHeight: textLineHeight,
    letterSpacing: textLetterSpacing,
    fontFamily: konvaTextFontFamily,
    fill: konvaTextFill,
    width: overflowLayout.width,
    height: overflowLayout.height,
  } satisfies Partial<Konva.TextConfig>);

  return {
    fieldText,
    isLabel,
    textToRender,
    textFontSize,
    textAlign,
    textVerticalAlign,
    textLineHeight,
    textLetterSpacing,
  };
};

export const renderGenericTextFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { mode = 'edit', pageLayer, color } = options;
  const { pageWidth, pageHeight } = options;
  const fieldMeta = field.fieldMeta as GenericTextFieldTypeMetas | undefined;

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
  const {
    fieldText,
    isLabel,
    textToRender,
    textFontSize,
    textAlign,
    textVerticalAlign,
    textLineHeight,
    textLetterSpacing,
  } = upsertFieldText(field, options);

  fieldGroup.add(fieldRect);
  fieldGroup.add(fieldText);

  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    // Adjust text scale so it doesn't change while group is resized.
    fieldText.scaleX(1 / groupScaleX);
    fieldText.scaleY(1 / groupScaleY);

    const rectWidth = fieldRect.width() * groupScaleX;
    const rectHeight = fieldRect.height() * groupScaleY;

    // During active transform, use crop dimensions (field bounds only).
    fieldText.x(DEFAULT_TEXT_X_PADDING);
    fieldText.y(0);
    fieldText.width(rectWidth - DEFAULT_TEXT_X_PADDING * 2);
    fieldText.height(rectHeight);
    fieldText.wrap('word');

    fieldGroup.getLayer()?.batchDraw();
  });

  fieldGroup.on('transformend', () => {
    fieldText.scaleX(1);
    fieldText.scaleY(1);

    const rectWidth = fieldRect.width();
    const rectHeight = fieldRect.height();

    // Recalculate overflow layout with new field dimensions.
    const newOverflowLayout = calculateOverflowLayout({
      overflowMode: resolveFieldOverflowMode(fieldMeta),
      isLabel,
      textToRender,
      fontSize: textFontSize,
      fontFamily: konvaTextFontFamily,
      lineHeight: textLineHeight,
      letterSpacing: textLetterSpacing,
      textAlign,
      verticalAlign: textVerticalAlign,
      baseX: DEFAULT_TEXT_X_PADDING,
      baseY: 0,
      baseWidth: rectWidth - DEFAULT_TEXT_X_PADDING * 2,
      baseHeight: rectHeight,
      groupX: fieldGroup.x(),
      groupY: fieldGroup.y(),
      pageWidth,
      pageHeight,
    });

    fieldText.x(newOverflowLayout.x);
    fieldText.y(newOverflowLayout.y);
    fieldText.width(newOverflowLayout.width);
    fieldText.height(newOverflowLayout.height);
    fieldText.wrap(newOverflowLayout.wrap);
    fieldText.verticalAlign(newOverflowLayout.verticalAlign);

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
