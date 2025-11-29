import sharp from 'sharp';

type Image = {
  contentType: string;
  content: Buffer;
};

export const optimiseAvatar = async (bytes: string): Promise<Buffer> => {
  return await sharp(Buffer.from(bytes, 'base64'))
    .resize(512, 512)
    .toFormat('jpeg', { quality: 75 })
    .toBuffer();
};

export const loadAvatar = async (bytes: string): Promise<Image> => {
  const content = await sharp(Buffer.from(bytes, 'base64')).toFormat('jpeg').toBuffer();
  return { contentType: 'image/jpeg', content };
};

export const loadLogo = async (file: Uint8Array): Promise<Image> => {
  const content = await sharp(file).toFormat('png', { quality: 80 }).toBuffer();
  return { contentType: 'image/png', content };
};

export const convertSVGToPNG = async (svg: string): Promise<Buffer> => {
  return await sharp(Buffer.from(svg)).toFormat('png').toBuffer();
};
