import type Konva from 'konva';

/**
 * Represents canvas references for a specific PDF page.
 */
export interface PageCanvasRefs {
  /** The page number (1-indexed) */
  pageNumber: number;
  /** The canvas element containing the rendered PDF */
  pdfCanvas: HTMLCanvasElement;
  /** The Konva stage containing field overlays */
  konvaStage: Konva.Stage;
}

/**
 * Module-level registry to store canvas references by page number.
 * This allows any component to access page canvases without prop drilling.
 */
const pageCanvasRegistry = new Map<number, PageCanvasRefs>();

/**
 * Register a page's canvas references.
 * Call this when a page renderer mounts and has valid canvas refs.
 *
 * @param refs - The canvas references to register
 */
export const registerPageCanvas = (refs: PageCanvasRefs): void => {
  pageCanvasRegistry.set(refs.pageNumber, refs);
};

/**
 * Unregister a page's canvas references.
 * Call this when a page renderer unmounts to prevent memory leaks.
 *
 * @param pageNumber - The page number to unregister
 */
export const unregisterPageCanvas = (pageNumber: number): void => {
  pageCanvasRegistry.delete(pageNumber);
};

/**
 * Get canvas references for a specific page.
 *
 * @param pageNumber - The page number to retrieve
 * @returns The canvas references, or undefined if not registered
 */
export const getPageCanvasRefs = (pageNumber: number): PageCanvasRefs | undefined => {
  return pageCanvasRegistry.get(pageNumber);
};

/**
 * Get all registered page numbers.
 *
 * @returns Array of page numbers currently registered
 */
export const getRegisteredPageNumbers = (): number[] => {
  return Array.from(pageCanvasRegistry.keys()).sort((a, b) => a - b);
};

/**
 * Composite a PDF page with its field overlays into a single PNG Blob.
 * This creates a temporary canvas, draws the PDF canvas first (background),
 * then draws the Konva canvas on top (field overlays).
 *
 * @param pageNumber - The page number to composite (1-indexed)
 * @returns Promise that resolves to a PNG Blob, or null if page not found or compositing fails
 */
export const compositePageToBlob = async (pageNumber: number): Promise<Blob | null> => {
  const refs = getPageCanvasRefs(pageNumber);

  if (!refs) {
    console.warn(`Page ${pageNumber} is not registered for canvas capture`);
    return null;
  }

  try {
    // Create temporary canvas with same dimensions as PDF canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = refs.pdfCanvas.width;
    tempCanvas.height = refs.pdfCanvas.height;

    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context for temporary canvas');
      return null;
    }

    // Draw PDF canvas first (background layer)
    ctx.drawImage(refs.pdfCanvas, 0, 0);

    // Get Konva canvas and draw on top (field overlays)
    // Note: Konva's toCanvas() returns a new canvas with all layers rendered
    const konvaCanvas = refs.konvaStage.toCanvas();
    ctx.drawImage(konvaCanvas, 0, 0);

    // Convert to PNG Blob
    return new Promise((resolve, reject) => {
      tempCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/png');
    });
  } catch (error) {
    console.error(`Error compositing page ${pageNumber}:`, error);
    return null;
  }
};
