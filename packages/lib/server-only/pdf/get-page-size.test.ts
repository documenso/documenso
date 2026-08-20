import { describe, expect, it } from 'vitest';
import { PDF_SIZE_A4_72PPI } from '../../constants/pdf';
import { getPageSize, getLastPageDimensions } from './get-page-size';

describe('getPageSize', () => {
  it('returns page MediaBox when present on page object', () => {
    const mockPage = {
      getMediaBox: () => ({ x: 0, y: 0, width: 595.28, height: 841.89 }),
      getCropBox: () => undefined,
      node: {},
    } as any;

    const size = getPageSize(mockPage);
    expect(size.width).toBeCloseTo(595.28);
    expect(size.height).toBeCloseTo(841.89);
  });

  it('resolves inherited MediaBox from parent /Pages node when absent on page', () => {
    const mockPage = {
      getMediaBox: () => {
        throw new Error('No direct media box');
      },
      getCropBox: () => undefined,
      node: {
        MediaBox: () => undefined,
        Parent: () => ({
          MediaBox: () => ({
            asArray: () => [
              { asNumber: () => 0 },
              { asNumber: () => 0 },
              { asNumber: () => 595.28 },
              { asNumber: () => 841.89 },
            ],
          }),
        }),
      },
    } as any;

    const size = getPageSize(mockPage);
    expect(size.width).toBeCloseTo(595.28);
    expect(size.height).toBeCloseTo(841.89);
  });

  it('uses CropBox when smaller than MediaBox', () => {
    const mockPage = {
      getMediaBox: () => ({ x: 0, y: 0, width: 600, height: 800 }),
      getCropBox: () => ({ x: 10, y: 10, width: 500, height: 700 }),
      node: {},
    } as any;

    const size = getPageSize(mockPage);
    expect(size.width).toBe(500);
    expect(size.height).toBe(700);
  });

  it('falls back to A4 when both MediaBox and CropBox are missing', () => {
    const mockPage = {
      getMediaBox: () => undefined,
      getCropBox: () => undefined,
      node: {},
    } as any;

    const size = getPageSize(mockPage);
    expect(size).toEqual(PDF_SIZE_A4_72PPI);
  });
});

describe('getLastPageDimensions', () => {
  it('returns last page dimensions when valid', () => {
    const mockPdf = {
      getPageCount: () => 2,
      getPage: (index: number) => ({ width: 595.28, height: 841.89 }),
    } as any;

    const dims = getLastPageDimensions(mockPdf);
    expect(dims).toEqual({ width: 595, height: 842 });
  });

  it('falls back to A4 when page dimensions are below minimum threshold', () => {
    const mockPdf = {
      getPageCount: () => 1,
      getPage: () => ({ width: 100, height: 100 }),
    } as any;

    const dims = getLastPageDimensions(mockPdf);
    expect(dims).toEqual(PDF_SIZE_A4_72PPI);
  });
});
