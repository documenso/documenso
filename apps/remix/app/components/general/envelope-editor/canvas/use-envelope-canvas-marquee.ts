import { useLatestRef } from '@documenso/lib/client-only/hooks/use-latest-ref';
import { KONVA_SELECTION_FILL_COLOR } from '@documenso/lib/universal/konva/constants';
import Konva from 'konva';
import { useCallback } from 'react';
import { clamp } from 'remeda';

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
      fill: KONVA_SELECTION_FILL_COLOR,
      visible: false,
    });

    layer.add(selectionRectangle);

    let x1 = 0;
    let y1 = 0;

    /**
     * The pointer in layer coordinates, pinned to the page.
     *
     * Pointer positions are in scaled stage coordinates, while the rectangle
     * lives on the scaled layer, so positions are divided by the stage scale.
     *
     * The pointer is clamped to the page so the rectangle stops at the page
     * edge while the mouse itself is free to leave it, matching how a
     * transformer resize behaves.
     */
    const getPointer = () => {
      const pointerPosition = stage.getPointerPosition();

      if (!pointerPosition) {
        return null;
      }

      return {
        x: clamp(pointerPosition.x / stage.scaleX(), { min: 0, max: stage.width() / stage.scaleX() }),
        y: clamp(pointerPosition.y / stage.scaleY(), { min: 0, max: stage.height() / stage.scaleY() }),
      };
    };

    // The stage only receives pointer events while the pointer is over its
    // container, so a drag which leaves the page would freeze the rectangle
    // and never finish. Like Konva's own transformer, the move and up events
    // are tracked on the window for the duration of a drag instead.
    const onWindowPointerMove = (evt: MouseEvent | TouchEvent) => {
      // The stage is rebuilt on zoom, which throws away this rectangle.
      if (!selectionRectangle.getStage()) {
        stopTrackingWindow();
        return;
      }

      // The stage cannot see the pointer once it is outside the container, so
      // register its position from the window event.
      stage.setPointersPositions(evt);

      const pointer = getPointer();

      if (!pointer) {
        return;
      }

      selectionRectangle.moveToTop();

      selectionRectangle.setAttrs({
        x: Math.min(x1, pointer.x),
        y: Math.min(y1, pointer.y),
        width: Math.abs(pointer.x - x1),
        height: Math.abs(pointer.y - y1),
      });
    };

    const onWindowPointerUp = () => {
      stopTrackingWindow();

      if (!selectionRectangle.getStage()) {
        return;
      }

      // Hide in a timeout so the click handler below can still detect that a
      // marquee drag just finished.
      setTimeout(() => {
        selectionRectangle.visible(false);
      });

      onSelectRef.current(selectionRectangle.getClientRect());
    };

    const startTrackingWindow = () => {
      window.addEventListener('mousemove', onWindowPointerMove);
      window.addEventListener('touchmove', onWindowPointerMove);
      window.addEventListener('mouseup', onWindowPointerUp);
      window.addEventListener('touchend', onWindowPointerUp);
      window.addEventListener('touchcancel', onWindowPointerUp);
    };

    const stopTrackingWindow = () => {
      window.removeEventListener('mousemove', onWindowPointerMove);
      window.removeEventListener('touchmove', onWindowPointerMove);
      window.removeEventListener('mouseup', onWindowPointerUp);
      window.removeEventListener('touchend', onWindowPointerUp);
      window.removeEventListener('touchcancel', onWindowPointerUp);
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

      startTrackingWindow();
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
