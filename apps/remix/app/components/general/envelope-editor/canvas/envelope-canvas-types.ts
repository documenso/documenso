import { CONTENT_GROUP_NODE_NAME } from '@documenso/lib/universal/content-renderer/content-renderer';
import type Konva from 'konva';
import type { RefObject } from 'react';

export type EnvelopeCanvas = {
  stage: RefObject<Konva.Stage | null>;
  pageLayer: RefObject<Konva.Layer | null>;

  scale: number;

  pageNumber: number;

  unscaledViewport: { width: number; height: number };

  scaledViewport: { width: number; height: number };
};

export type EnvelopeCanvasSelectionKind = 'field' | 'content';

/**
 * Fields and contents share one transformer, so only one kind can be selected
 * at a time.
 */
export type EnvelopeCanvasSelection = {
  kind: EnvelopeCanvasSelectionKind;
  groups: Konva.Group[];
} | null;

export const ENVELOPE_CANVAS_GROUP_NAMES: Record<EnvelopeCanvasSelectionKind, string> = {
  // Defined by the field renderer in `field-generic-items.ts`.
  field: 'field-group',
  content: CONTENT_GROUP_NODE_NAME,
};

/**
 * A box in scaled stage coordinates, e.g. from a client rect.
 */
export type EnvelopeCanvasBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
