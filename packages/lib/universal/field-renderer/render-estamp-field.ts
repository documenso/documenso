import Konva from 'konva';

import {
  createFieldHoverInteraction,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';

const createFieldEstamp = (): Konva.Group => {
  const fieldWidth = 180;
  const fieldHeight = 80;

  const estampGroup = new Konva.Group();
  const fontSize = 10;

  // Add border rectangle
  const borderRect = new Konva.Rect({
    x: 0,
    y: 0,
    width: fieldWidth,
    height: fieldHeight,
    stroke: 'darkblue',
    strokeWidth: 1,
    cornerRadius: 5,
    fill: 'transparent',
  });
  estampGroup.add(borderRect);

  const lineHeight = fieldHeight / 6;

  // Line 1: Company logo (hardcoded text for now)
  const logoText = new Konva.Text({
    text: 'LOGO',
    x: 10,
    y: 0,
    width: fieldWidth - 20,
    height: lineHeight,
    fontSize: fontSize,
    align: 'center',
    verticalAlign: 'middle',
    fontStyle: 'bold',
  });
  estampGroup.add(logoText);

  // Line 2: Request ID (hardcoded)
  const requestIdText = new Konva.Text({
    text: `Request ID: REQ-12345`,
    x: 10,
    y: lineHeight,
    width: fieldWidth - 20,
    height: lineHeight,
    fontSize: fontSize,
    align: 'center',
    verticalAlign: 'middle',
  });
  estampGroup.add(requestIdText);

  // Line 3: Current date
  const now = new Date().toLocaleDateString();
  const dateText = new Konva.Text({
    text: now,
    x: 10,
    y: 2 * lineHeight,
    width: fieldWidth - 20,
    height: lineHeight,
    fontSize: fontSize,
    align: 'center',
    verticalAlign: 'middle',
  });
  estampGroup.add(dateText);

  // Line 4: From (hardcoded requester ID)
  const fromText = new Konva.Text({
    text: `From: 987654`,
    x: 10,
    y: 3 * lineHeight,
    width: fieldWidth - 20,
    height: lineHeight,
    fontSize: fontSize,
    align: 'center',
    verticalAlign: 'middle',
  });
  estampGroup.add(fromText);

  // Line 5: Barcode (hardcoded random numbers)
  const barcodeText = new Konva.Text({
    text: '123456789012',
    x: 10,
    y: 4 * lineHeight,
    width: fieldWidth - 20,
    height: lineHeight,
    fontSize: fontSize,
    align: 'center',
    verticalAlign: 'middle',
    fontFamily: 'monospace',
  });
  estampGroup.add(barcodeText);

  return estampGroup;
};

export const renderEstampFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { mode = 'edit', pageLayer, color } = options;

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
  const fieldSignature = createFieldEstamp();

  fieldGroup.add(fieldRect);
  fieldGroup.add(fieldSignature);

  // This is to keep the estamp inside the field at the same size
  // when the field is resized. Without this the estamp would be stretched.
  const originalRectWidth = fieldRect.width();
  const originalRectHeight = fieldRect.height();

  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    // Adjust estamp scale so it doesn't change while group is resized.
    fieldSignature.scaleX(1 / groupScaleX);
    fieldSignature.scaleY(1 / groupScaleY);

    // Update rect dimensions
    fieldRect.width(originalRectWidth * groupScaleX);
    fieldRect.height(originalRectHeight * groupScaleY);

    fieldGroup.getLayer()?.batchDraw();
  });

  // Reset the estamp after transform has ended.
  fieldGroup.on('transformend', () => {
    fieldSignature.scaleX(1);
    fieldSignature.scaleY(1);

    // Reset rect dimensions
    fieldRect.width(originalRectWidth);
    fieldRect.height(originalRectHeight);

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
