import { describe, expect, it } from 'vitest';

import { getV2OverlayPlacement } from './get-page-size';

describe('getV2OverlayPlacement', () => {
  it('matches the page when the CropBox equals the MediaBox (origin 0,0)', () => {
    const placement = getV2OverlayPlacement({ x: 0, y: 0, width: 612, height: 792 }, 0);

    expect(placement).toEqual({
      pageWidth: 612,
      pageHeight: 792,
      translateX: 0,
      translateY: 0,
    });
  });

  it('offsets the overlay by a non-zero CropBox origin', () => {
    // A CropBox inset 20pt from the left and 30pt from the bottom of a Letter MediaBox.
    const placement = getV2OverlayPlacement({ x: 20, y: 30, width: 572, height: 732 }, 0);

    // Overlay is sized to the CropBox (the rendered viewport)...
    expect(placement.pageWidth).toBe(572);
    expect(placement.pageHeight).toBe(732);

    // ...and shifted so it sits over the CropBox region rather than the page origin.
    expect(placement.translateX).toBe(20);
    expect(placement.translateY).toBe(30);
  });

  it('swaps dimensions and positions the overlay for a 90 degree rotation', () => {
    const placement = getV2OverlayPlacement({ x: 10, y: 5, width: 600, height: 800 }, 90);

    // Rendered (visual) orientation is landscape, so the dimensions swap.
    expect(placement.pageWidth).toBe(800);
    expect(placement.pageHeight).toBe(600);

    // The visual bottom-left maps to the bottom-right corner of the CropBox region.
    expect(placement.translateX).toBe(10 + 600);
    expect(placement.translateY).toBe(5);
  });

  it('positions the overlay for a 180 degree rotation', () => {
    const placement = getV2OverlayPlacement({ x: 10, y: 5, width: 600, height: 800 }, 180);

    expect(placement.pageWidth).toBe(600);
    expect(placement.pageHeight).toBe(800);

    expect(placement.translateX).toBe(10 + 600);
    expect(placement.translateY).toBe(5 + 800);
  });

  it('swaps dimensions and positions the overlay for a 270 degree rotation', () => {
    const placement = getV2OverlayPlacement({ x: 10, y: 5, width: 600, height: 800 }, 270);

    expect(placement.pageWidth).toBe(800);
    expect(placement.pageHeight).toBe(600);

    expect(placement.translateX).toBe(10);
    expect(placement.translateY).toBe(5 + 800);
  });
});
