import sharp from 'sharp';

export const loadLogo = async (file: Uint8Array) => {
  const content = await sharp(file).toFormat('png', { quality: 80 }).toBuffer();

  return {
    contentType: 'image/png',
    content,
  };
};

/**
 * Validate and sanitise an uploaded branding logo. Re-encoding through `sharp`
 * proves the bytes are a real raster image and strips any embedded payloads.
 * Throws if the input cannot be parsed as an image.
 */
export const optimiseBrandingLogo = async (input: Buffer | Uint8Array): Promise<Buffer> => {
  return await sharp(input)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 80 })
    .toBuffer();
};
