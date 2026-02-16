import sharp from 'sharp';

export const svgToPng = async (svg: string) => {
  return await sharp(Buffer.from(svg)).toFormat('png').toBuffer();
};
