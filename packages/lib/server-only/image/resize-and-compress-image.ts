import sharp from 'sharp';

export const resizeAndCompressImage = async (imageBuffer: Buffer): Promise<Buffer> => {
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 0;

  if (originalWidth > 1000) {
    return await sharp(imageBuffer)
      .resize({ width: 1000, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  return await sharp(imageBuffer).jpeg({ quality: 70 }).toBuffer();
};
