import Konva from 'konva';

import { DEFAULT_SIGNATURE_TEXT_FONT_SIZE } from '../../constants/pdf';
import { AppError } from '../../errors/app-error';
import {
  createFieldHoverInteraction,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import { calculateFieldPosition } from './field-renderer';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SkiaImage: any = undefined;

void (async () => {
  if (typeof window === 'undefined') {
    const mod = await import('skia-canvas');
    SkiaImage = mod.Image;
  }
})();

const getImageDimensions = (img: HTMLImageElement, fieldWidth: number, fieldHeight: number) => {
  let imageWidth = img.width;
  let imageHeight = img.height;

  const scalingFactor = Math.min(fieldWidth / imageWidth, fieldHeight / imageHeight, 1);

  imageWidth = imageWidth * scalingFactor;
  imageHeight = imageHeight * scalingFactor;

  const imageX = (fieldWidth - imageWidth) / 2;
  const imageY = (fieldHeight - imageHeight) / 2;

  return {
    width: imageWidth,
    height: imageHeight,
    x: imageX,
    y: imageY,
  };
};

/**
 * The pixel ratio used when caching the signature image as an offscreen bitmap.
 *
 * Konva's default redraw composites the source image with low-quality scaling
 * which makes signatures look blurry, especially when the source PNG is much
 * larger than the field. Caching at a high pixel ratio rasterises the shape
 * once into a sharp bitmap that is then reused on every redraw.
 *
 * Multiplied by `devicePixelRatio` to keep the cache crisp on retina displays.
 */
const SIGNATURE_IMAGE_CACHE_PIXEL_RATIO = 2;

/**
 * Build a Konva.Image for a base64 signature, sized to fit within the given
 * field dimensions. Works in both browser and Node.js (via skia-canvas).
 */
const createSignatureImage = (
  signatureImageAsBase64: string,
  fieldWidth: number,
  fieldHeight: number,
): Konva.Image => {
  if (typeof window !== 'undefined') {
    const img = new Image();

    const image = new Konva.Image({
      image: img,
      x: 0,
      y: 0,
      width: fieldWidth,
      height: fieldHeight,
    });

    img.onload = () => {
      image.setAttrs({
        image: img,
        ...getImageDimensions(img, fieldWidth, fieldHeight),
      });

      // Cache the image as a high-resolution bitmap so it stays sharp on
      // redraws and zoom changes instead of being re-scaled from the source PNG
      // every time.
      image.cache({
        pixelRatio: SIGNATURE_IMAGE_CACHE_PIXEL_RATIO * (window.devicePixelRatio || 1),
      });
    };

    img.src = signatureImageAsBase64;

    return image;
  }

  // Node.js with skia-canvas
  if (!SkiaImage) {
    throw new Error('Skia image not found');
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const img = new SkiaImage(signatureImageAsBase64) as unknown as HTMLImageElement;

  return new Konva.Image({
    image: img,
    ...getImageDimensions(img, fieldWidth, fieldHeight),
  });
};

const createFieldSignature = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
): Konva.Text | Konva.Image => {
  const { pageWidth, pageHeight, mode = 'edit', translations } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);
  const fontSize = field.fieldMeta?.fontSize || DEFAULT_SIGNATURE_TEXT_FONT_SIZE;

  const fieldText = new Konva.Text({
    id: `${field.renderId}-text`,
    name: 'field-text',
  });

  const fieldTypeName = translations?.[field.type] || field.type;

  // Calculate text positioning based on alignment
  const textX = 0;
  const textY = 0;

  let textToRender: string = fieldTypeName;

  const signature = field.signature;

  // Handle edit mode.
  if (mode === 'edit') {
    textToRender = fieldTypeName;

    // If the field has already been signed and we have the signature data
    // available, render it. Otherwise leave the field type label as a placeholder.
    if (field.inserted && signature?.typedSignature) {
      textToRender = signature.typedSignature;
    }

    if (field.inserted && signature?.signatureImageAsBase64) {
      return createSignatureImage(signature.signatureImageAsBase64, fieldWidth, fieldHeight);
    }
  }

  // Handle sign mode.
  if (mode === 'sign' || mode === 'export') {
    textToRender = fieldTypeName;

    if (field.inserted && !signature) {
      throw new AppError('MISSING_SIGNATURE');
    }

    if (signature?.typedSignature) {
      textToRender = signature.typedSignature;
    }

    if (signature?.signatureImageAsBase64) {
      return createSignatureImage(signature.signatureImageAsBase64, fieldWidth, fieldHeight);
    }
  }

  fieldText.setAttrs({
    x: textX,
    y: textY,
    verticalAlign: 'middle',
    wrap: 'char',
    text: textToRender,
    fontSize,
    fontFamily: 'Caveat, sans-serif',
    align: 'center',
    width: fieldWidth,
    height: fieldHeight,
  } satisfies Partial<Konva.TextConfig>);

  return fieldText;
};

export const renderSignatureFieldElement = (
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
  const fieldSignature = createFieldSignature(field, options);

  fieldGroup.add(fieldRect);
  fieldGroup.add(fieldSignature);

  // This is to keep the text inside the field at the same size
  // when the field is resized. Without this the text would be stretched.
  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    // Adjust text scale so it doesn't change while group is resized.
    fieldSignature.scaleX(1 / groupScaleX);
    fieldSignature.scaleY(1 / groupScaleY);

    const rectWidth = fieldRect.width() * groupScaleX;
    const rectHeight = fieldRect.height() * groupScaleY;

    // Update text dimensions
    fieldSignature.width(rectWidth);
    fieldSignature.height(rectHeight);

    // Force Konva to recalculate text layout
    fieldSignature.height();

    fieldGroup.getLayer()?.batchDraw();
  });

  // Reset the text after transform has ended.
  fieldGroup.on('transformend', () => {
    fieldSignature.scaleX(1);
    fieldSignature.scaleY(1);

    const rectWidth = fieldRect.width();
    const rectHeight = fieldRect.height();

    // Update text dimensions
    fieldSignature.width(rectWidth); // Account for padding
    fieldSignature.height(rectHeight);

    // Force Konva to recalculate text layout
    fieldSignature.height();

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
