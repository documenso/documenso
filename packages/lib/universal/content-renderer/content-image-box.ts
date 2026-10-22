import type { PercentageBox, Size } from '../../utils/geometry';
import { toPercentage, toPixels } from '../../utils/geometry';

/**
 * The size of an image content when dropped from the palette, as a
 * percentage of the page.
 */
export const CONTENT_IMAGE_DEFAULT_SIZE = { width: 15, height: 10 } as const;

/**
 * A box content's geometry as a percentage of the page.
 */
type ContentBox = PercentageBox;

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
 * The box an image content takes when an image is attached to it, so the box
 * has the image's shape.
 *
 * The box keeps its width and its top left corner, and its height follows the
 * image's ratio. If that runs past the right or bottom of the page, the box
 * is shrunk (ratio intact) until it fits.
 */
export const resolveAttachedImageBox = ({ image, page, box }: ResolveAttachedImageBoxOptions): ContentBox => {
  if (image.width <= 0 || image.height <= 0 || page.width <= 0 || page.height <= 0 || box.width <= 0) {
    return box;
  }

  const ratio = image.height / image.width;

  // The box's own width may already run past the page, e.g. a box dropped at
  // the edge, so the width is capped to the room beside it as well.
  const availableWidth = toPixels(100 - box.positionX, page.width);
  const availableHeight = toPixels(100 - box.positionY, page.height);

  let width = Math.min(toPixels(box.width, page.width), availableWidth);
  let height = width * ratio;

  if (height > availableHeight) {
    height = availableHeight;
    width = height / ratio;
  }

  return {
    positionX: box.positionX,
    positionY: box.positionY,
    width: toPercentage(width, page.width),
    height: toPercentage(height, page.height),
  };
};
