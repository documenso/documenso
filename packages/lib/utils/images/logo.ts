import sharp from 'sharp';

export const loadLogo = async (file: Uint8Array) => {
  const content = await sharp(file).toFormat('png', { quality: 80 }).toBuffer();

  return {
    contentType: 'image/png',
    content,
  };
};
