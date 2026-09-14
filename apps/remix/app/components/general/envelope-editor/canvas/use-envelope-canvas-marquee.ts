import { useLatestRef } from '@documenso/lib/client-only/hooks/use-latest-ref';
import Konva from 'konva';
import { useCallback } from 'react';

import type { EnvelopeCanvasBox } from './envelope-canvas-types';

type UseEnvelopeCanvasMarqueeOptions = {
  /**
   * Called when a marquee drag ends, with the selection box in scaled stage
   * coordinates. The caller decides what the box selects.
   */
  onSelect: (box: EnvelopeCanvasBox) => void;

  /**
   * Called when an empty area of the stage is clicked without dragging.
   */
  onEmptyClick: () => void;
};

/**
 * Drag-to-select marquee on an empty area of the stage.
 *
 * The callbacks are read through refs, so the once-bound stage handlers always
 * delegate to the latest render's logic.
 */
export const useEnvelopeCanvasMarquee = ({ onSelect, onEmptyClick }: UseEnvelopeCanvasMarqueeOptions) => {
  const onSelectRef = useLatestRef(onSelect);
  const onEmptyClickRef = useLatestRef(onEmptyClick);

  /**
   * Bind the marquee to a stage. Called once when the page canvas is created.
   */
  const bind = useCallback((stage: Konva.Stage, layer: Konva.Layer) => {
    const selectionRectangle = new Konva.Rect({
      name: 'marquee-selection',
      fill: 'rgba(24, 160, 251, 0.3)',
      visible: false,
    });

    layer.add(selectionRectangle);

    let x1 = 0;
    let y1 = 0;

    // Pointer positions are in scaled stage coordinates, while the rectangle
    // lives on the scaled layer, so positions are divided by the stage scale.
    const getPointer = () => {
      const pointerPosition = stage.getPointerPosition();

      if (!pointerPosition) {
        return null;
      }

      return { x: pointerPosition.x / stage.scaleX(), y: pointerPosition.y / stage.scaleY() };
    };

    stage.on('mousedown.marquee touchstart.marquee', (e) => {
      // Do nothing if the pointer is down on a shape.
      if (e.target !== stage) {
        return;
      }

      const pointer = getPointer();

      if (!pointer) {
        return;
      }

      x1 = pointer.x;
      y1 = pointer.y;

      selectionRectangle.setAttrs({
        x: x1,
        y: y1,
        width: 0,
        height: 0,
        visible: true,
      });
    });

    stage.on('mousemove.marquee touchmove.marquee', () => {
      if (!selectionRectangle.visible()) {
        return;
      }

      selectionRectangle.moveToTop();

      const pointer = getPointer();

      if (!pointer) {
        return;
      }

      selectionRectangle.setAttrs({
        x: Math.min(x1, pointer.x),
        y: Math.min(y1, pointer.y),
        width: Math.abs(pointer.x - x1),
        height: Math.abs(pointer.y - y1),
      });
    });

    stage.on('mouseup.marquee touchend.marquee', () => {
      if (!selectionRectangle.visible()) {
        return;
      }

      // Hide in a timeout so the click handler below can still detect that a
      // marquee drag just finished.
      setTimeout(() => {
        selectionRectangle.visible(false);
      });

      onSelectRef.current(selectionRectangle.getClientRect());
    });

    stage.on('click.marquee tap.marquee', (e) => {
      // A marquee drag just finished, the selection was handled on mouse up.
      if (selectionRectangle.visible() && selectionRectangle.width() > 0 && selectionRectangle.height() > 0) {
        return;
      }

      if (e.target === stage) {
        onEmptyClickRef.current();
      }
    });
  }, []);

  return { bind };
};

/**
 * Find the groups of a given name which intersect a box, excluding groups
 * which are not draggable (i.e. not currently editable).
 */
export const findEnvelopeCanvasGroupsInBox = (stage: Konva.Stage, groupName: string, box: EnvelopeCanvasBox) => {
  return stage
    .find(`.${groupName}`)
    .filter(
      (node): node is Konva.Group =>
        node instanceof Konva.Group && node.draggable() && Konva.Util.haveIntersection(box, node.getClientRect()),
    );
};
