import {
  type CheckboxField,
  type DropdownField,
  type FormField,
  type ListBoxField,
  PDF,
  type RadioField,
  type TextField,
} from '@libpdf/core';
import { FieldType } from '@prisma/client';

import type { TDetectedField } from '@documenso/lib/types/detected-field';
import type { TFieldMetaNotOptionalSchema } from '@documenso/lib/types/field-meta';

// `WidgetAnnotation` is not exported from `@libpdf/core`, so derive its type
// from the field API instead.
type WidgetAnnotation = ReturnType<FormField['getWidgets']>[number];

/**
 * Fallback height (as a % of page height) for widgets that report a degenerate
 * (zero/near-zero) rectangle, so the imported field is still selectable.
 */
const DEFAULT_FIELD_HEIGHT_PERCENT = 2;
const DEFAULT_FIELD_WIDTH_PERCENT = 10;
const MIN_DIMENSION_PERCENT = 0.1;

/**
 * Map a `@libpdf/core` form field type to a Documenso field type.
 *
 * Returns `null` for field types Documenso cannot represent (push buttons,
 * non-terminal container fields, unknown types) so the caller can skip them.
 */
export const mapAcroFormFieldType = (libpdfType: string): FieldType | null => {
  switch (libpdfType) {
    case 'text':
      return FieldType.TEXT;
    case 'checkbox':
      return FieldType.CHECKBOX;
    case 'radio':
      return FieldType.RADIO;
    case 'dropdown':
    case 'listbox':
      return FieldType.DROPDOWN;
    case 'signature':
      return FieldType.SIGNATURE;
    default:
      return null;
  }
};

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

/**
 * Convert a widget rectangle (PDF user space, bottom-left origin) into the
 * percentage-based, top-left-origin coordinates used by the Field model.
 *
 * Pure helper - exported for unit testing.
 */
export const widgetRectToPercentages = (
  rect: [number, number, number, number],
  pageWidth: number,
  pageHeight: number,
): { positionX: number; positionY: number; width: number; height: number } => {
  const [x1, y1, x2, y2] = rect;

  const left = Math.min(x1, x2);
  const bottom = Math.min(y1, y2);
  const rectWidth = Math.abs(x2 - x1);
  const rectHeight = Math.abs(y2 - y1);

  // Flip the Y axis: PDF origin is bottom-left, the Field model is top-left.
  const top = pageHeight - bottom - rectHeight;

  const widthPercent = pageWidth > 0 ? (rectWidth / pageWidth) * 100 : 0;
  const heightPercent = pageHeight > 0 ? (rectHeight / pageHeight) * 100 : 0;

  const finalWidth =
    widthPercent > MIN_DIMENSION_PERCENT ? widthPercent : DEFAULT_FIELD_WIDTH_PERCENT;
  const finalHeight =
    heightPercent > MIN_DIMENSION_PERCENT ? heightPercent : DEFAULT_FIELD_HEIGHT_PERCENT;

  const positionX = pageWidth > 0 ? (left / pageWidth) * 100 : 0;
  const positionY = pageHeight > 0 ? (top / pageHeight) * 100 : 0;

  return {
    positionX: clampPercent(positionX),
    positionY: clampPercent(positionY),
    // Keep the field on the page if it would otherwise overflow the edge.
    width: clampPercent(Math.min(finalWidth, 100 - clampPercent(positionX))),
    height: clampPercent(Math.min(finalHeight, 100 - clampPercent(positionY))),
  };
};

type PageInfo = { index: number; width: number; height: number };

/**
 * Whether a widget rectangle lies within a page's media box (assumed to start
 * at the origin, which holds for the overwhelming majority of forms). Used as a
 * last-resort heuristic to place a widget whose page references cannot be
 * resolved any other way.
 */
const rectWithinPageBounds = (rect: [number, number, number, number], page: PageInfo): boolean => {
  const [x1, y1, x2, y2] = rect;

  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);

  return minX >= 0 && minY >= 0 && maxX <= page.width && maxY <= page.height;
};

/**
 * Resolve the page a widget belongs to.
 *
 * The `/P` (page) entry on a widget annotation is *optional* in the PDF spec,
 * and many real-world forms (especially Acrobat-generated government forms)
 * omit it. When it is missing we fall back to the page whose `/Annots` array
 * references the widget - the same fallback `@libpdf/core` uses internally when
 * flattening.
 *
 * Some forms defeat both lookups: their widget references cannot be reconciled
 * with the page objects (e.g. an indirect-vs-direct reference mismatch in
 * `@libpdf/core`), so neither `/P` nor `/Annots` matches for *any* widget. The
 * PA government forms behave this way - all 98 widgets fail to resolve and the
 * entire form is lost. Rather than drop those fields, fall back to:
 *   1. page 0 for a single-page document (the only page it can belong to), and
 *   2. the page whose bounds contain the widget rect for multi-page documents,
 *      defaulting to the first page when nothing matches.
 */
const resolveWidgetPage = (
  widget: WidgetAnnotation,
  pages: PageInfo[],
  pageInfoByPageRef: Map<string, PageInfo>,
  pageInfoByAnnotRef: Map<string, PageInfo>,
): PageInfo | undefined => {
  const pageRef = widget.pageRef?.toString();

  if (pageRef) {
    const info = pageInfoByPageRef.get(pageRef);

    if (info) {
      return info;
    }
  }

  const annotRef = widget.ref?.toString();

  if (annotRef) {
    const info = pageInfoByAnnotRef.get(annotRef);

    if (info) {
      return info;
    }
  }

  // Both reference lookups missed - recover the page instead of dropping the
  // field (see the doc comment above).
  if (pages.length === 1) {
    return pages[0];
  }

  if (pages.length > 1) {
    return pages.find((page) => rectWithinPageBounds(widget.rect, page)) ?? pages[0];
  }

  return undefined;
};

/**
 * Build the Documenso field meta for a detected field, preserving as much of
 * the original PDF field's configuration as the Documenso model allows.
 */
const buildFieldMeta = (
  type: FieldType,
  field: FormField,
  widget: WidgetAnnotation,
): TFieldMetaNotOptionalSchema | undefined => {
  const label = field.alternateName || field.partialName || field.name;
  const required = field.isRequired();
  const readOnly = field.isReadOnly();

  switch (type) {
    case FieldType.TEXT: {
      const textField = field as TextField;
      const maxLength = textField.maxLength;
      const alignment = textField.alignment;

      return {
        type: 'text',
        label,
        required,
        readOnly,
        characterLimit: maxLength > 0 ? maxLength : undefined,
        textAlign: alignment === 1 ? 'center' : alignment === 2 ? 'right' : 'left',
      };
    }

    case FieldType.CHECKBOX: {
      const checkbox = field as CheckboxField;
      const value = widget.getOnValue() ?? checkbox.getOnValue() ?? 'Yes';

      return {
        type: 'checkbox',
        label,
        required,
        readOnly,
        values: [{ id: 1, checked: checkbox.isChecked(), value }],
        direction: 'vertical',
      };
    }

    case FieldType.RADIO: {
      const radio = field as RadioField;
      const widgetValue = widget.getOnValue();
      const selected = radio.getValue();
      const value = widgetValue ?? 'Option 1';

      return {
        type: 'radio',
        label,
        required,
        readOnly,
        values: [{ id: 1, checked: widgetValue !== null && widgetValue === selected, value }],
        direction: 'vertical',
      };
    }

    case FieldType.DROPDOWN: {
      const choice = field as DropdownField | ListBoxField;
      const options = choice.getOptions();
      const values = options
        .map((option) => option.display || option.value)
        .filter((value): value is string => Boolean(value))
        .map((value) => ({ value }));

      return {
        type: 'dropdown',
        label,
        required,
        readOnly,
        values: values.length > 0 ? values : undefined,
      };
    }

    case FieldType.SIGNATURE: {
      return {
        type: 'signature',
        label,
        required,
        readOnly,
      };
    }

    default:
      return undefined;
  }
};

/**
 * Detect interactive form fields (AcroForm fields) in an uploaded PDF.
 *
 * This must run on the *original* PDF buffer, before `normalizePdf` flattens
 * the form, since flattening permanently removes the interactive fields.
 *
 * Each visible widget becomes a detected field positioned at the widget's
 * location. Field types Documenso cannot represent (e.g. push buttons) are
 * skipped. Never throws - on any parsing failure it returns an empty array so
 * upload is never blocked by detection.
 */
export const detectAcroFormFields = async (pdf: Buffer): Promise<TDetectedField[]> => {
  try {
    const pdfDoc = await PDF.load(new Uint8Array(pdf)).catch(() => null);

    if (!pdfDoc || pdfDoc.isEncrypted || !pdfDoc.hasForm()) {
      return [];
    }

    const form = pdfDoc.getForm();

    if (!form) {
      return [];
    }

    // Map every page reference to its index and dimensions so widgets can be
    // resolved to a page without a second lookup.
    const pageInfoByPageRef = new Map<string, PageInfo>();
    // Fallback lookup for widgets that omit the optional `/P` entry: map each
    // annotation reference to the page whose `/Annots` array contains it.
    const pageInfoByAnnotRef = new Map<string, PageInfo>();
    // Ordered list of pages, used by the last-resort fallbacks in
    // `resolveWidgetPage` when neither reference lookup matches.
    const pages: PageInfo[] = [];

    for (const page of pdfDoc.getPages()) {
      const pageInfo: PageInfo = {
        index: page.index,
        width: page.width,
        height: page.height,
      };

      pages.push(pageInfo);

      if (page.ref) {
        pageInfoByPageRef.set(page.ref.toString(), pageInfo);
      }

      const annots = page.dict.getArray('Annots');

      if (annots) {
        for (let i = 0; i < annots.length; i++) {
          const annotRef = annots.at(i);

          if (annotRef) {
            pageInfoByAnnotRef.set(annotRef.toString(), pageInfo);
          }
        }
      }
    }

    const detectedFields: TDetectedField[] = [];

    for (const field of form.getFields()) {
      const type = mapAcroFormFieldType(field.type);

      if (!type) {
        continue;
      }

      for (const widget of field.getWidgets()) {
        if (widget.isHidden()) {
          continue;
        }

        const pageInfo = resolveWidgetPage(widget, pages, pageInfoByPageRef, pageInfoByAnnotRef);

        // Only unreachable when the document has no pages; keep as a guard so a
        // widget is never placed against a missing page.
        if (!pageInfo) {
          continue;
        }

        const position = widgetRectToPercentages(widget.rect, pageInfo.width, pageInfo.height);

        detectedFields.push({
          type,
          page: pageInfo.index + 1,
          name: field.name,
          fieldMeta: buildFieldMeta(type, field, widget),
          ...position,
        });
      }
    }

    return detectedFields;
  } catch (error) {
    // Detection is best-effort and must never block an upload.
    console.error(
      `AcroForm field detection failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );

    return [];
  }
};
