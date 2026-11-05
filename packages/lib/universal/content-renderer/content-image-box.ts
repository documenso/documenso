import type { PercentageBox, Size } from '../../utils/geometry';
import { toPercentage, toPixels } from '../../utils/geometry';

export const CONTENT_IMAGE_DEFAULT_SIZE = { width: 15, height: 10 } as const;

type ContentBox = PercentageBox;

type ResolveAttachedImageBoxOptions = {
  image: Size;

  page: Size;

  box: ContentBox;
};

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
