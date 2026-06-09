import {
  FIELD_PROBE_ANCHOR_SELECTOR,
  FIELD_ROOT_CONTAINER_PROBE_CLASS_NAME,
} from '@documenso/ui/lib/field-root-container-classes';
import { colord } from 'colord';

import type { FieldCanvasStyle, FieldRenderMode, FieldToRender } from './field-renderer';

export type FieldCanvasStyleCache = Map<string, FieldCanvasStyle | undefined>;

export const createFieldCanvasStyleCache = (): FieldCanvasStyleCache => new Map();

export const getFieldCanvasStyleCacheKey = (field: FieldToRender) =>
  `${field.type}:${field.inserted}:${field.fieldMeta?.readOnly ?? false}:${field.isValidating ?? false}`;

export const getPixelValue = (value: string) => {
  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue)) {
    return undefined;
  }

  return parsedValue;
};

export const getOpacityValue = (value: string) => {
  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue) || parsedValue === 1) {
    return undefined;
  }

  return Math.max(0, Math.min(parsedValue, 1));
};

// Canonical value Konva paints as fully transparent. We normalize transparent
// inputs to this so the renderer can tell "customer asked for transparent"
// (honored — paint nothing) apart from "no custom style" (undefined — fall back
// to the renderer default).
export const TRANSPARENT_COLOR = 'rgba(0, 0, 0, 0)';

export const getRenderableColor = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const color = colord(value);

  // Unparseable input (e.g. `none`) has no canvas meaning, so fall back to the
  // renderer defaults. Inputs come from `getComputedStyle`, which normalizes to
  // `rgb()`/`rgba()`, so the base colord parser (no named-colors plugin) is
  // sufficient here. The `transparent` keyword is the one exception colord
  // reports as invalid; we treat it as an explicit transparent request.
  if (!color.isValid()) {
    return value.trim().toLowerCase() === 'transparent' ? TRANSPARENT_COLOR : undefined;
  }

  // A fully transparent color is a deliberate choice — honor it by painting
  // nothing rather than falling back to the default background/border.
  if (color.alpha() === 0) {
    return TRANSPARENT_COLOR;
  }

  return value;
};

/**
 * Build a throwaway field container that mirrors the real `FieldRootContainer`
 * (same classes + data attributes) so we can read whatever the active embed CSS
 * resolves for this field's state.
 *
 * `transition` is disabled because we read the computed style synchronously right
 * after attaching — leaving transitions on would surface mid-animation values.
 * `visibility: hidden` + zero size keep it invisible and out of layout flow
 * without using `display: none`, which would prevent border/background resolution.
 */
const createFieldProbeElement = (field: FieldToRender): HTMLElement => {
  const $probe = document.createElement('div');

  $probe.className = FIELD_ROOT_CONTAINER_PROBE_CLASS_NAME;
  $probe.setAttribute('aria-hidden', 'true');

  $probe.dataset.fieldType = field.type;
  $probe.dataset.inserted = field.inserted ? 'true' : 'false';
  $probe.dataset.validate = field.isValidating ? 'true' : 'false';
  $probe.dataset.readonly = field.fieldMeta?.readOnly ? 'true' : 'false';

  Object.assign($probe.style, {
    position: 'absolute',
    width: '0',
    height: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    visibility: 'hidden',
    transition: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  return $probe;
};

const computeFieldCanvasStyleFromProbe = (field: FieldToRender): FieldCanvasStyle | undefined => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return undefined;
  }

  // The probe must be appended inside the same subtree as the real fields so it
  // inherits the identical CSS cascade. Custom embed CSS is typically scoped
  // under `.embed--DocumentContainer`; appending to `document.body` would resolve
  // a different (wrong) cascade. If the anchor is absent (non-embed contexts),
  // there is no custom field CSS to read, so we skip the probe entirely.
  const $anchor = document.querySelector(FIELD_PROBE_ANCHOR_SELECTOR);

  if (!$anchor) {
    return undefined;
  }

  const $probe = createFieldProbeElement(field);

  $anchor.appendChild($probe);

  try {
    const computedStyle = window.getComputedStyle($probe);
    const borderWidth = getPixelValue(computedStyle.borderTopWidth);
    const borderColor = getRenderableColor(computedStyle.borderTopColor);
    const hasBorderStyle = computedStyle.borderTopStyle !== 'none' && Boolean(borderWidth);
    const borderRadius = getPixelValue(computedStyle.borderTopLeftRadius);

    return {
      backgroundColor: getRenderableColor(computedStyle.backgroundColor),
      borderColor: hasBorderStyle ? borderColor : undefined,
      borderRadius,
      borderWidth: hasBorderStyle ? borderWidth : undefined,
      opacity: getOpacityValue(computedStyle.opacity),
    };
  } finally {
    $probe.remove();
  }
};

/**
 * Resolve the canvas style for a field by reading a throwaway probe element's
 * computed CSS.
 *
 * Sign-mode only — the editor and export views intentionally use the renderer
 * defaults. Reads are cache-gated, so the probe is created/removed at most once
 * per unique field state per render pass.
 */
export const resolveFieldCanvasStyle = (
  field: FieldToRender,
  mode: FieldRenderMode,
  cache?: FieldCanvasStyleCache,
): FieldCanvasStyle | undefined => {
  if (mode !== 'sign') {
    return undefined;
  }

  const cacheKey = getFieldCanvasStyleCacheKey(field);

  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const style = computeFieldCanvasStyleFromProbe(field);

  cache?.set(cacheKey, style);

  return style;
};
