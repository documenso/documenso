import { KONVA_SELECTION_FILL_COLOR } from '@documenso/lib/universal/konva/constants';
import type { PercentageBox } from '@documenso/lib/utils/geometry';
import { toPercentageBox } from '@documenso/lib/utils/geometry';
import Konva from 'konva';
import { useState } from 'react';

import type { EnvelopeCanvas, EnvelopeCanvasBox } from './envelope-canvas-types';

type UseEnvelopeCanvasPendingCreationOptions = {
  canvas: EnvelopeCanvas;

  nodeName: string;
};

export const useEnvelopeCanvasPendingCreation = ({ canvas, nodeName }: UseEnvelopeCanvasPendingCreationOptions) => {
  const { pageLayer, scale, unscaledViewport } = canvas;

  const [pendingCreation, setPendingCreation] = useState<Konva.Rect | null>(null);

  const clearPending = () => {
    setPendingCreation(null);

    for (const node of pageLayer.current?.find(`.${nodeName}`) ?? []) {
      node.destroy();
    }
  };

  const setPendingFromBox = (box: EnvelopeCanvasBox) => {
    const layer = pageLayer.current;

    if (!layer) {
      return;
    }

    // The rectangle lives on the scaled layer, so the box is unscaled first.
    const pendingRect = new Konva.Rect({
      name: nodeName,
      x: box.x / scale,
      y: box.y / scale,
      width: box.width / scale,
      height: box.height / scale,
      fill: KONVA_SELECTION_FILL_COLOR,
    });

    layer.add(pendingRect);
    setPendingCreation(pendingRect);
  };

  const getPendingBox = (): PercentageBox | null => {
    if (!pendingCreation) {
      return null;
    }

    return toPercentageBox(
      {
        x: pendingCreation.x(),
        y: pendingCreation.y(),
        width: pendingCreation.width(),
        height: pendingCreation.height(),
      },
      unscaledViewport,
    );
  };

  return { pendingCreation, clearPending, setPendingFromBox, getPendingBox };
};
