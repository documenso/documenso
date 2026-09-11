/**
 * !: This is a workaround to fix the memory leak in the skia-canvas library.
 * !: Internals are ported from the original `konva/skia-backend.js` file.
 */

import { Canvas, DOMMatrix, Image, Path2D } from '@documenso/skia-canvas';
import { Konva } from 'konva/lib/_CoreInternals';

// @ts-expect-error skia-canvas satisfies the requirements
global.DOMMatrix = DOMMatrix;

// @ts-expect-error skia-canvas satisfies the requirements
global.Path2D = Path2D;
Path2D.prototype.toString = () => '[object Path2D]';

Konva.Util['createCanvasElement'] = () => {
  const node = new Canvas(300, 300);
  node.gpu = false;

  if (!('style' in node) || !node['style']) {
    Object.assign(node, { style: {} });
  }

  node.toString = () => '[object HTMLCanvasElement]';
  const ctx = node.getContext('2d');

  Object.defineProperty(ctx, 'canvas', {
    get: () => node,
  });

  return node as unknown as HTMLCanvasElement;
};

Konva.Util.createImageElement = () => {
  const node = new Image();
  node.toString = () => '[object HTMLImageElement]';

  return node as unknown as HTMLImageElement;
};

Konva._renderBackend = '@documenso/skia-canvas';

export default Konva;
