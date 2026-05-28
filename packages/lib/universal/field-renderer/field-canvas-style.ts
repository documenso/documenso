import { FIELD_ROOT_CONTAINER_PROBE_SELECTOR } from '@documenso/ui/lib/field-root-container-classes';

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

export const getRenderableColor = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.replace(/\s+/g, '').toLowerCase();

  if (
    normalizedValue === 'transparent' ||
    normalizedValue === 'rgba(0,0,0,0)' ||
    /rgba\([^)]*,0(?:\.0+)?\)$/.test(normalizedValue)
  ) {
    return undefined;
  }

  return value;
};

const computeFieldCanvasStyleFromProbe = (field: FieldToRender): FieldCanvasStyle | undefined => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return undefined;
  }

  const $fieldRootContainer = document.querySelector<HTMLElement>(FIELD_ROOT_CONTAINER_PROBE_SELECTOR);

  if (!$fieldRootContainer) {
    return undefined;
  }

  $fieldRootContainer.dataset.fieldType = field.type;
  $fieldRootContainer.dataset.inserted = field.inserted ? 'true' : 'false';
  $fieldRootContainer.dataset.validate = field.isValidating ? 'true' : 'false';
  $fieldRootContainer.dataset.readonly = field.fieldMeta?.readOnly ? 'true' : 'false';

  const computedStyle = window.getComputedStyle($fieldRootContainer);
  const borderWidth = getPixelValue(computedStyle.borderTopWidth);
  const borderColor = getRenderableColor(computedStyle.borderTopColor);
  const hasBorderStyle = computedStyle.borderTopStyle !== 'none' && Boolean(borderWidth);
  const borderRadius = getPixelValue(computedStyle.borderTopLeftRadius);

  return {
    backgroundColor: getRenderableColor(computedStyle.backgroundColor),
    borderColor: hasBorderStyle ? borderColor : undefined,
    borderRadius: borderRadius ? borderRadius : undefined,
    borderWidth: hasBorderStyle ? borderWidth : undefined,
    opacity: getOpacityValue(computedStyle.opacity),
  };
};

/**
 * Resolve the canvas style for a field by reading the probe element's computed CSS.
 *
 * Sign-mode only — the editor and export views intentionally use the renderer defaults,
 * since the probe element is mounted by the signing page only.
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
