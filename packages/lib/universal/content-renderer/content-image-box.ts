import { clamp } from 'remeda';

import type { PercentageBox, Size } from '../../utils/geometry';
import { toPercentage, toPixelRect } from '../../utils/geometry';
import { calculateContainFit } from './content-renderer';

/**
 * The size of an image content when dropped from the palette, as a
 * percentage of the page.
 *
 * Defined in page units rather than screen pixels so "still the default size"
 * is a stable comparison across zoom levels and reloads.
 */
export const CONTENT_IMAGE_DEFAULT_SIZE = { width: 15, height: 10 } as const;

/**
 * The largest fraction of the page width or height an image is auto sized to.
 */
const CONTENT_IMAGE_MAX_PAGE_FRACTION = 0.8;

/**
 * How image pixels map to page points when auto sizing: one pixel is one
 * point at scale 1.
 */
const CONTENT_IMAGE_PIXELS_PER_POINT = 1;

/**
 * A box content's geometry as a percentage of the page.
 */
type ContentBox = PercentageBox;

/**
 * Whether a box is still the size it was dropped at, i.e. the author has not
 * resized it. Only the transformer changes a content's size, so equality is
 * sufficient.
 */
export const isContentImageDefaultSize = (box: Size) => {
  return box.width === CONTENT_IMAGE_DEFAULT_SIZE.width && box.height === CONTENT_IMAGE_DEFAULT_SIZE.height;
};

type ResolveAttachedImageBoxOptions = {
  /**
   * The intrinsic image size in pixels.
   */
  image: Size;

  /**
   * The unscaled page size in points.
   */
  page: Size;

  /**
   * The content's current box.
   */
  box: ContentBox;
};

/**
 * The box an image content takes when an image is attached to it,
 * so the box always has the image's shape:
 *
 * - A box the author has not resized is sized to the image at its native
 *   size, capped to a fraction of the page and shifted to stay within it.
 * - A box the author has sized is tightened around the image fitted within
 *   it, so it never grows beyond what was drawn but sheds any letterboxing.
 */
export const resolveAttachedImageBox = ({ image, page, box }: ResolveAttachedImageBoxOptions): ContentBox => {
  if (image.width <= 0 || image.height <= 0 || page.width <= 0 || page.height <= 0) {
    return box;
  }

  if (isContentImageDefaultSize(box)) {
    return autoSizeBox({ image, page, box });
  }

  return tightenBox({ image, page, box });
};

const autoSizeBox = ({ image, page, box }: ResolveAttachedImageBoxOptions): ContentBox => {
  const maxWidth = page.width * CONTENT_IMAGE_MAX_PAGE_FRACTION;
  const maxHeight = page.height * CONTENT_IMAGE_MAX_PAGE_FRACTION;

  const ratio = image.height / image.width;

  let width = Math.min(image.width / CONTENT_IMAGE_PIXELS_PER_POINT, maxWidth);
  let height = width * ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height / ratio;
  }

  const widthPercent = toPercentage(width, page.width);
  const heightPercent = toPercentage(height, page.height);

  return {
    positionX: clampPosition(box.positionX, widthPercent),
    positionY: clampPosition(box.positionY, heightPercent),
    width: widthPercent,
    height: heightPercent,
  };
};

const tightenBox = ({ image, page, box }: ResolveAttachedImageBoxOptions): ContentBox => {
  const fit = calculateContainFit(image, toPixelRect(box, page));

  return {
    positionX: box.positionX + toPercentage(fit.x, page.width),
    positionY: box.positionY + toPercentage(fit.y, page.height),
    width: toPercentage(fit.width, page.width),
    height: toPercentage(fit.height, page.height),
  };
};

/**
 * Shift a position so the given extent stays within the page.
 */
const clampPosition = (position: number, extent: number) => clamp(position, { min: 0, max: 100 - extent });
