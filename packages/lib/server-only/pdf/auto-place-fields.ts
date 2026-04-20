import { PDF, rgb } from '@libpdf/core';
import type { FieldType, Recipient } from '@prisma/client';

import { type TFieldAndMeta, ZEnvelopeFieldAndMetaSchema } from '@documenso/lib/types/field-meta';

import { parseFieldMetaFromPlaceholder, parseFieldTypeFromPlaceholder } from './helpers';

const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g;
const DEFAULT_FIELD_HEIGHT_PERCENT = 2;
const MIN_HEIGHT_THRESHOLD = 0.01;

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Draw white rectangles over specified regions in a loaded PDF document.
 *
 * Mutates the PDF in place. Coordinates use bottom-left origin (standard PDF coordinates).
 */
export const whiteoutRegions = (
  pdfDoc: PDF,
  regions: Array<{ pageIndex: number; bbox: BoundingBox }>,
): void => {
  const pages = pdfDoc.getPages();

  for (const { pageIndex, bbox } of regions) {
    const page = pages[pageIndex];

    page.drawRectangle({
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      color: rgb(1, 1, 1),
      borderColor: rgb(1, 1, 1),
      borderWidth: 2,
    });
  }
};

export type PlaceholderInfo = {
  placeholder: string;
  recipient: string;
  fieldAndMeta: TFieldAndMeta;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

export type FieldToCreate = TFieldAndMeta & {
  envelopeItemId?: string;
  recipientId: number;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export const extractPlaceholdersFromPDF = async (pdf: Buffer): Promise<PlaceholderInfo[]> => {
  const pdfDoc = await PDF.load(new Uint8Array(pdf));

  const placeholders: PlaceholderInfo[] = [];

  for (const page of pdfDoc.getPages()) {
    const pageWidth = page.width;
    const pageHeight = page.height;

    const matches = page.findText(PLACEHOLDER_REGEX);

    for (const match of matches) {
      const placeholder = match.text;

      /*
        Extract the inner content from the placeholder match.
        E.g. '{{SIGNATURE, r1, required=true}}' -> 'SIGNATURE, r1, required=true'
      */
      const innerMatch = placeholder.match(/^\{\{([^}]+)\}\}$/);

      if (!innerMatch) {
        continue;
      }

      const placeholderData = innerMatch[1].split(',').map((property) => property.trim());
      const [fieldTypeString, recipientOrMeta, ...fieldMetaData] = placeholderData;

      let fieldType: FieldType;

      try {
        fieldType = parseFieldTypeFromPlaceholder(fieldTypeString);
      } catch {
        // Skip placeholders with unrecognized field types.
        continue;
      }

      /*
        A recipient identifier (e.g. "r1", "R2") is required for auto-placement.
        Placeholders without an explicit recipient like {{name}} are reserved for
        future API use where callers can reference a placeholder by name with
        optional dimensions instead of absolute coordinates.
      */
      if (!recipientOrMeta || !/^r\d+$/i.test(recipientOrMeta)) {
        continue;
      }

      const recipient = recipientOrMeta;

      const rawFieldMeta = Object.fromEntries(fieldMetaData.map((property) => property.split('=')));

      const parsedFieldMeta = parseFieldMetaFromPlaceholder(rawFieldMeta, fieldType);

      const fieldAndMeta: TFieldAndMeta = ZEnvelopeFieldAndMetaSchema.parse({
        type: fieldType,
        fieldMeta: parsedFieldMeta,
      });

      /*
        LibPDF returns bbox in points with bottom-left origin.
        Convert Y to top-left origin for consistency with the rest of the system.
      */
      const topLeftY = pageHeight - match.bbox.y - match.bbox.height;

      placeholders.push({
        placeholder,
        recipient,
        fieldAndMeta,
        page: page.index + 1,
        x: match.bbox.x,
        y: topLeftY,
        width: match.bbox.width,
        height: match.bbox.height,
        pageWidth,
        pageHeight,
      });
    }
  }

  return placeholders;
};

/**
 * Draw white rectangles over placeholder text in a PDF.
 *
 * Accepts optional pre-extracted placeholders to avoid re-parsing the PDF.
 */
export const removePlaceholdersFromPDF = async (
  pdf: Buffer,
  placeholders?: PlaceholderInfo[],
): Promise<Buffer> => {
  const resolved = placeholders ?? (await extractPlaceholdersFromPDF(pdf));

  const pdfDoc = await PDF.load(new Uint8Array(pdf));
  const pages = pdfDoc.getPages();

  /*
    Convert PlaceholderInfo[] to whiteout regions.
    PlaceholderInfo uses top-left origin, but whiteoutRegions expects bottom-left.
  */
  const regions = resolved.map((p) => {
    const page = pages[p.page - 1];
    const bottomLeftY = page.height - p.y - p.height;

    return {
      pageIndex: p.page - 1,
      bbox: { x: p.x, y: bottomLeftY, width: p.width, height: p.height },
    };
  });

  whiteoutRegions(pdfDoc, regions);

  const modifiedPdfBytes = await pdfDoc.save();

  return Buffer.from(modifiedPdfBytes);
};

/**
 * Extract placeholders from a PDF and remove them from the document.
 *
 * Returns the cleaned PDF buffer and the extracted placeholders. If no
 * placeholders are found the original buffer is returned as-is.
 */
export const extractPdfPlaceholders = async (
  pdf: Buffer,
): Promise<{ cleanedPdf: Buffer; placeholders: PlaceholderInfo[] }> => {
  const placeholders = await extractPlaceholdersFromPDF(pdf);

  if (placeholders.length === 0) {
    return { cleanedPdf: pdf, placeholders: [] };
  }

  const cleanedPdf = await removePlaceholdersFromPDF(pdf, placeholders);

  return { cleanedPdf, placeholders };
};

/**
 * Convert pre-extracted PlaceholderInfo[] to field creation inputs.
 *
 * Pure data transform — converts point-based coordinates to percentages and
 * resolves recipient references via the provided callback. No DB calls.
 */
export const convertPlaceholdersToFieldInputs = (
  placeholders: PlaceholderInfo[],
  recipientResolver: (recipientPlaceholder: string, placeholder: string) => Pick<Recipient, 'id'>,
  envelopeItemId?: string,
): FieldToCreate[] => {
  return placeholders.map((p) => {
    const xPercent = (p.x / p.pageWidth) * 100;
    const yPercent = (p.y / p.pageHeight) * 100;
    const widthPercent = (p.width / p.pageWidth) * 100;
    const heightPercent = (p.height / p.pageHeight) * 100;

    const finalHeightPercent =
      heightPercent > MIN_HEIGHT_THRESHOLD ? heightPercent : DEFAULT_FIELD_HEIGHT_PERCENT;

    const recipient = recipientResolver(p.recipient, p.placeholder);

    return {
      ...p.fieldAndMeta,
      envelopeItemId,
      recipientId: recipient.id,
      page: p.page,
      positionX: xPercent,
      positionY: yPercent,
      width: widthPercent,
      height: finalHeightPercent,
    };
  });
};
