import sharp from 'sharp';

export const TARGET_SIZE = 1000;

type ResizeImageToGeminiImageOptions = {
  image: Buffer;
  size?: number;
};

/**
 * Resize image to 1000x1000 using fill strategy.
 * Scales to cover the target area and crops any overflow.
 */
export const resizeImageToGeminiImage = async ({
  image,
  size = TARGET_SIZE,
}: ResizeImageToGeminiImageOptions) => {
  return await sharp(image).resize(size, size, { fit: 'fill' }).toBuffer();
};
