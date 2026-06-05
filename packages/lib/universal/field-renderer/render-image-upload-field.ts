import Konva from 'konva';
import type { TImageUploadFieldMeta } from '../../types/field-meta';
import { createFieldHoverInteraction, upsertFieldGroup, upsertFieldRect } from './field-generic-items';
import { calculateFieldPosition, type FieldToRender, type RenderFieldElementOptions } from './field-renderer';
import { createSignatureImage } from './render-signature-field';

type FieldImageUpload =
  | {
      node: Konva.Text;
      isImage: false;
      isLabel: boolean;
    }
  | {
      node: Konva.Image;
      isImage: true;
      isLabel: boolean;
    };

const createFieldImageUpload = (field: FieldToRender, options: RenderFieldElementOptions): FieldImageUpload => {
  const { pageWidth, pageHeight, mode = 'edit', translations } = options;

  const { fieldX, fieldY, fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);
  const fontSize = field.fieldMeta?.fontSize || 12;

  const fieldText = new Konva.Text({
    id: `${field.renderId}-text`,
    name: 'field-text',
  });

  const fieldTypeName = translations?.[field.type] || 'Image Upload';

  // For image upload fields, prioritize the custom label over customText
  const textToRender: string = field.fieldMeta?.label || field.customText || fieldTypeName;

  const signature = field.signature;

  // Handle edit, sign, and export modes.
  if (
    (mode === 'edit' && field.inserted && signature?.signatureImageAsBase64) ||
    ((mode === 'sign' || mode === 'export') && signature?.signatureImageAsBase64)
  ) {
    return {
      node: createSignatureImage(signature.signatureImageAsBase64, fieldWidth, fieldHeight),
      isImage: true,
      isLabel: false,
    };
  }

  const fieldMeta = field.fieldMeta as TImageUploadFieldMeta | undefined;

  // Whether we're rendering the field type name vs actual uploaded content.
  const isLabel = true;

  const fieldTextAttrs: Partial<Konva.TextConfig> = {
    x: 0,
    y: 0,
    text: textToRender,
    fontSize,
    fontFamily: 'Inter, sans-serif',
    align: fieldMeta?.textAlign || 'center',
    verticalAlign: 'middle',
    width: fieldWidth,
    height: fieldHeight,
  };

  // Simple centering for the label since we don't need complex overflow for "Image Upload"
  fieldText.setAttrs(fieldTextAttrs);

  return { node: fieldText, isImage: false, isLabel };
};

export const renderImageUploadFieldElement = (field: FieldToRender, options: RenderFieldElementOptions) => {
  const { mode = 'edit', pageLayer, pageWidth, pageHeight, color } = options;

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  const fieldGroup = upsertFieldGroup(field, options);

  // Clear previous children and listeners to re-render fresh.
  fieldGroup.removeChildren();
  fieldGroup.off('transform');

  // Assign elements to group and any listeners that should only be run on initialization.
  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  // Render the field background and text.
  const fieldRect = upsertFieldRect(field, options);
  const { node: fieldImage, isImage, isLabel } = createFieldImageUpload(field, options);

  fieldGroup.add(fieldRect);
  fieldGroup.add(fieldImage);

  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    // Adjust image/text scale so it doesn't change while group is resized.
    fieldImage.scaleX(1 / groupScaleX);
    fieldImage.scaleY(1 / groupScaleY);

    const rectWidth = fieldRect.width() * groupScaleX;
    const rectHeight = fieldRect.height() * groupScaleY;

    if (!isImage) {
      fieldImage.x(0);
      fieldImage.y(0);
      fieldImage.wrap('word');
    }

    fieldImage.width(rectWidth);
    fieldImage.height(rectHeight);

    fieldGroup.getLayer()?.batchDraw();
  });

  fieldGroup.on('transformend', () => {
    fieldImage.scaleX(1);
    fieldImage.scaleY(1);

    const rectWidth = fieldRect.width();
    const rectHeight = fieldRect.height();

    if (!isImage) {
      fieldImage.x(0);
      fieldImage.y(0);
      fieldImage.width(rectWidth);
      fieldImage.height(rectHeight);
    } else {
      fieldImage.width(rectWidth);
      fieldImage.height(rectHeight);
    }

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
