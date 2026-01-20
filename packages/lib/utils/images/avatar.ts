import sharp from 'sharp';

export const optimiseAvatar = async (bytes: string) => {
  return await sharp(Buffer.from(bytes, 'base64'))
    .resize(512, 512)
    .toFormat('jpeg', { quality: 75 })
    .toBuffer();
};

export const loadAvatar = async (bytes: string) => {
  const content = await sharp(Buffer.from(bytes, 'base64')).toFormat('jpeg').toBuffer();
  return {
    contentType: 'image/jpeg',
    content,
  };
};
