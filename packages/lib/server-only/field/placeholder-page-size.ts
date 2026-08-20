import { PDFDocument } from '@cantoo/pdf-lib';

import { getPageSize } from '../pdf/get-page-size';

export type EffectivePageSize = { width: number; height: number };

/**
 * Resolve each page's effective size with PDF-spec MediaBox inheritance.
 *
 * `@libpdf/core`'s page width/height reads the page's own `MediaBox` entry
 * only: a `MediaBox` declared on the `/Pages` node — legal per PDF
 * 32000-1:2008 §7.7.3.4 and what fpdf2 emits by default for same-size pages —
 * reads as missing and falls back to US Letter, stretching every
 * placeholder-derived coordinate by the Letter/A4 ratio and silently dropping
 * fields that land outside the assumed page (#3267). pdf-lib's lookup walks
 * `/Parent`, so sizes resolved here are the ones the viewer shows.
 *
 * @param bytes The PDF bytes to resolve sizes for.
 * @returns Effective `{ width, height }` per page, in points.
 */
export async function resolveEffectivePageSizes(bytes: Uint8Array): Promise<EffectivePageSize[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPages().map((page) => {
    const box = getPageSize(page);
    return { width: box.width, height: box.height };
  });
}

/**
 * Map a text-search bounding box to percentage-based field coordinates.
 *
 * Pure so the Letter/A4 regression (#3267) is unit-testable without the
 * envelope/prisma harness: the caller supplies the effective page size
 * (see {@link resolveEffectivePageSizes}), and this does the point →
 * percent math exactly as the placeholder flow always has.
 *
 * @param bbox The match's bounding box in PDF points (bottom-left origin).
 * @param pageSize The effective page size in points.
 * @param fieldSize Optional explicit width/height percentages; when absent
 * they derive from the bounding box.
 * @returns Percentage coordinates in the system's top-left-origin format.
 */
export function mapBoundingBoxToFieldPosition(
  bbox: { x: number; y: number; width: number; height: number },
  pageSize: EffectivePageSize,
  fieldSize?: { width?: number; height?: number },
): { positionX: number; positionY: number; width: number; height: number } {
  const topLeftY = pageSize.height - bbox.y - bbox.height;

  return {
    positionX: (bbox.x / pageSize.width) * 100,
    positionY: (topLeftY / pageSize.height) * 100,
    width: fieldSize?.width ?? (bbox.width / pageSize.width) * 100,
    height: fieldSize?.height ?? (bbox.height / pageSize.height) * 100,
  };
}

/**
 * Pick the page size a placeholder coordinate mapping should use.
 *
 * Prefers the inheritance-resolved size but keeps `@libpdf/core`'s
 * (rotation-aware) value whenever the two agree, so rotated pages and
 * explicit-MediaBox documents take exactly their current path.
 *
 * @param resolved Inheritance-resolved size (may be missing for a page the
 * resolver could not load).
 * @param libpdfSize The text layer's own page width/height.
 * @returns The size to divide coordinates by.
 */
export function pickPageSize(
  resolved: EffectivePageSize | undefined,
  libpdfSize: EffectivePageSize,
): EffectivePageSize {
  if (resolved === undefined) return libpdfSize;
  if (resolved.width === libpdfSize.width && resolved.height === libpdfSize.height) {
    return libpdfSize;
  }
  return resolved;
}
