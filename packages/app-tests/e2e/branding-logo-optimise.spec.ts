import { optimiseBrandingLogo } from '@documenso/lib/utils/images/logo';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const makePng = async (width = 1200, height = 1200) =>
  sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();

test.describe('optimiseBrandingLogo', () => {
  test('re-encodes a valid image to a PNG buffer', async () => {
    const input = await makePng();

    const output = await optimiseBrandingLogo(input);

    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe('png');
  });

  test('bounds the image to a maximum of 512px on its largest side', async () => {
    const input = await makePng(2000, 1000);

    const output = await optimiseBrandingLogo(input);

    const metadata = await sharp(output).metadata();

    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
  });

  test('rejects input that is not a valid image', async () => {
    await expect(optimiseBrandingLogo(Buffer.from('this is not an image'))).rejects.toThrow();
  });
});
