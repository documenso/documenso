import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../errors/app-error';
import {
  CONTENT_IMAGE_MAX_EDGE,
  CONTENT_IMAGE_MAX_FILE_NAME_LENGTH,
  getNormalizedImageFileName,
  normalizeImage,
} from './normalize-image';

const createImage = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 200, g: 40, b: 40, alpha: 1 },
    },
  });

describe('normalizeImage', () => {
  it('keeps the dimensions and format of a png within the size limit', async () => {
    const input = await createImage(30, 20).png().toBuffer();

    const result = await normalizeImage(input);

    expect(result).toMatchObject({ width: 30, height: 20, mimeType: 'image/png' });

    const output = await sharp(result.buffer).metadata();

    expect(output).toMatchObject({ format: 'png', width: 30, height: 20 });
  });

  it('keeps jpeg images as jpeg', async () => {
    const input = await createImage(30, 20).jpeg().toBuffer();

    const result = await normalizeImage(input);

    expect(result.mimeType).toBe('image/jpeg');
    expect((await sharp(result.buffer).metadata()).format).toBe('jpeg');
  });

  it('keeps webp images as webp', async () => {
    const input = await createImage(30, 20).webp().toBuffer();

    const result = await normalizeImage(input);

    expect(result.mimeType).toBe('image/webp');
    expect((await sharp(result.buffer).metadata()).format).toBe('webp');
  });

  it('downscales images larger than the maximum edge while preserving the aspect ratio', async () => {
    const input = await createImage(CONTENT_IMAGE_MAX_EDGE * 2, CONTENT_IMAGE_MAX_EDGE / 2)
      .png()
      .toBuffer();

    const result = await normalizeImage(input);

    expect(result).toMatchObject({ width: CONTENT_IMAGE_MAX_EDGE, height: CONTENT_IMAGE_MAX_EDGE / 4 });
  });

  it('preserves transparency', async () => {
    const input = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const result = await normalizeImage(input);

    const { data } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });

    // The alpha byte of the first RGBA pixel.
    expect(data[3]).toBe(0);
  });

  it('applies the EXIF orientation and strips the tag', async () => {
    // Orientation 6 means the stored pixels must be rotated 90° clockwise to
    // be displayed correctly, which swaps the width and height.
    const input = await createImage(30, 20).jpeg().withMetadata({ orientation: 6 }).toBuffer();

    expect((await sharp(input).metadata()).orientation).toBe(6);

    const result = await normalizeImage(input);

    expect(result).toMatchObject({ width: 20, height: 30 });

    const output = await sharp(result.buffer).metadata();

    expect(output).toMatchObject({ width: 20, height: 30 });
    expect(output.orientation).toBeUndefined();
  });

  it('rejects image formats outside the allowlist', async () => {
    const input = await createImage(10, 10).gif().toBuffer();

    await expect(normalizeImage(input)).rejects.toMatchObject({ code: 'INVALID_IMAGE_FILE' });
  });

  it('rejects svg images', async () => {
    const input = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');

    await expect(normalizeImage(input)).rejects.toMatchObject({ code: 'INVALID_IMAGE_FILE' });
  });

  it('rejects bytes which are not an image', async () => {
    const input = Buffer.from('definitely not an image');

    const error = await normalizeImage(input).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('INVALID_IMAGE_FILE');
  });

  it('rejects images exceeding the input pixel limit', async () => {
    const input = await createImage(100, 100).png().toBuffer();

    await expect(normalizeImage(input, { maxInputPixels: 50 * 50 })).rejects.toMatchObject({
      code: 'INVALID_IMAGE_FILE',
    });
  });
});

describe('getNormalizedImageFileName', () => {
  it('replaces the extension with the one matching the normalized format', () => {
    expect(getNormalizedImageFileName('photo.JPEG', 'image/jpeg')).toBe('photo.jpg');
    expect(getNormalizedImageFileName('logo.png', 'image/webp')).toBe('logo.webp');
  });

  it('appends an extension when the name has none', () => {
    expect(getNormalizedImageFileName('stamp', 'image/png')).toBe('stamp.png');
  });

  it('only strips a trailing image extension', () => {
    expect(getNormalizedImageFileName('my.png.backup', 'image/png')).toBe('my.png.backup.png');
  });

  it('truncates long names, which are echoed back as a response header', () => {
    const normalized = getNormalizedImageFileName(`${'a'.repeat(5_000)}.png`, 'image/png');

    expect(normalized.length).toBeLessThanOrEqual(CONTENT_IMAGE_MAX_FILE_NAME_LENGTH + '.png'.length);
    expect(normalized.endsWith('.png')).toBe(true);
  });

  it('strips characters which cannot appear in a header', () => {
    expect(getNormalizedImageFileName('a\r\nb\tc.png', 'image/png')).toBe('a b c.png');
  });
});
