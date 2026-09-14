import { CONTENT_GROUP_NODE_NAME } from '@documenso/lib/universal/content-renderer/content-renderer';
import type Konva from 'konva';
import type { RefObject } from 'react';

/**
 * The shared canvas handles and page metrics passed to the envelope canvas
 * hooks, sourced from `usePageRenderer` and the page render data.
 */
export type EnvelopeCanvas = {
  stage: RefObject<Konva.Stage | null>;
  pageLayer: RefObject<Konva.Layer | null>;

  /**
   * The scale of the stage relative to the unscaled page.
   */
  scale: number;

  pageNumber: number;

  /**
   * The raw page size in pixels.
   */
  unscaledViewport: { width: number; height: number };

  /**
   * The page size in pixels as rendered on the stage.
   */
  scaledViewport: { width: number; height: number };
};

export type EnvelopeCanvasSelectionKind = 'field' | 'content';

/**
 * The current canvas selection. Fields and contents share one transformer, so
 * only one kind can be selected at a time.
 */
export type EnvelopeCanvasSelection = {
  kind: EnvelopeCanvasSelectionKind;
  groups: Konva.Group[];

  /**
   * Whether the selection was made programmatically (e.g. on creation) rather
   * than by the user.
   */
  isAuto: boolean;
} | null;

/**
 * The Konva group names for each selectable kind.
 */
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
