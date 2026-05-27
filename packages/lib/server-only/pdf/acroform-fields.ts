import {
  PDF,
  type PDFPage,
  type PdfDict,
  type PdfObject,
  type PdfRef,
  type PdfStream,
  type PdfString,
} from '@libpdf/core';
import { FieldType, type Recipient } from '@prisma/client';
import {
  FIELD_CHECKBOX_META_DEFAULT_VALUES,
  FIELD_DATE_META_DEFAULT_VALUES,
  FIELD_DROPDOWN_META_DEFAULT_VALUES,
  FIELD_EMAIL_META_DEFAULT_VALUES,
  FIELD_INITIALS_META_DEFAULT_VALUES,
  FIELD_NAME_META_DEFAULT_VALUES,
  FIELD_NUMBER_META_DEFAULT_VALUES,
  FIELD_RADIO_META_DEFAULT_VALUES,
  FIELD_SIGNATURE_META_DEFAULT_VALUES,
  FIELD_TEXT_META_DEFAULT_VALUES,
  type TCheckboxFieldMeta,
  type TDropdownFieldMeta,
  type TFieldAndMeta,
  type TNumberFieldMeta,
  type TRadioFieldMeta,
  type TTextFieldMeta,
  ZEnvelopeFieldAndMetaSchema,
} from '../../types/field-meta';
import { logger } from '../../utils/logger';
import type { FieldToCreate } from './auto-place-fields';

/**
 * Local shape for the widget annotations returned by @libpdf/core.
 *
 * The library exposes WidgetAnnotation as a class but does not re-export the
 * type from its public surface. We duck-type the subset we actually read.
 */
type WidgetAnnotation = {
  readonly rect: [number, number, number, number];
  readonly width: number;
  readonly height: number;
  readonly pageRef: PdfRef | null;
  isHidden(): boolean;
  getOnValue(): string | null;
};

/**
 * Function shape that follows a {@link PdfRef} to the referenced object.
 *
 * `@libpdf/core` does not re-export the `RefResolver` type alias, so we redeclare
 * it locally. Built via {@link makeResolver} from a loaded {@link PDF}.
 */
type RefResolver = (ref: PdfRef) => PdfObject | null;

const makeResolver =
  (pdfDoc: PDF): RefResolver =>
  (ref: PdfRef) =>
    pdfDoc.context.resolve(ref);

const DEFAULT_FIELD_HEIGHT_PERCENT = 2;
const MIN_HEIGHT_THRESHOLD = 0.01;

const DATE_NAME_PATTERN = /date|dob|birth/i;
const NUMBER_NAME_PATTERN = /amount|qty|count|number/i;
const EMAIL_NAME_PATTERN = /email|e[-_]?mail/i;
const NAME_NAME_PATTERN = /name/i;
const INITIALS_NAME_PATTERN = /initial/i;

const ROW_TOLERANCE_PERCENT = 2;
const ACROFORM_FIELD_SOURCE = 'acroform';

export type AcroFormUnsupportedReason =
  | 'unsupported-type'
  | 'hidden'
  | 'off-page'
  | 'zero-size'
  | 'no-page-match'
  | 'signed-signature'
  | 'rotated-out-of-bounds';

export type AcroFormSkipReason = 'encrypted' | 'xfa-hybrid' | 'no-form' | 'error';

export type AcroFormFieldImportInfo = {
  source: 'acroform';
  fieldName: string;
  widgetIndex: number;
  fieldAndMeta: TFieldAndMeta;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

export type AcroFormUnsupportedFieldInfo = {
  fieldName: string;
  acroFormType: string;
  reason: AcroFormUnsupportedReason;
};

export type AcroFormExtractionResult = {
  fields: AcroFormFieldImportInfo[];
  unsupported: AcroFormUnsupportedFieldInfo[];
  /**
   * True when a signed signature widget was found.
   *
   * Callers MUST set `flattenForm: false` for that envelope item so the signed
   * PDF is not re-flattened (which would invalidate the signature).
   */
  hasSignedSignature: boolean;
  /**
   * Set when extraction returned empty for a reason that should be surfaced in
   * logs but not propagated to the user. Absent when extraction ran normally.
   */
  skipReason?: AcroFormSkipReason;
};

type ResolvedGeometry = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

const EMPTY_RESULT = (skipReason?: AcroFormSkipReason): AcroFormExtractionResult => ({
  fields: [],
  unsupported: [],
  hasSignedSignature: false,
  skipReason,
});

/**
 * Detect XFA-hybrid PDFs by inspecting the catalog's `/AcroForm` dict for an
 * `/XFA` key.
 *
 * Uses public accessors (`pdf.context.catalog.getDict()`) and a {@link RefResolver}
 * so an indirect `/AcroForm` entry is followed. Returns `false` on any error
 * (e.g. malformed catalog) so the caller can fall through to normal extraction.
 */
const hasXfa = (pdfDoc: PDF, resolver: RefResolver): boolean => {
  try {
    const catalogDict = pdfDoc.context.catalog.getDict();
    const acroFormDict = catalogDict.getDict('AcroForm', resolver);

    return Boolean(acroFormDict?.has('XFA'));
  } catch {
    return false;
  }
};

const isDateFieldByName = (name: string | null | undefined): boolean => !!name && DATE_NAME_PATTERN.test(name);

const isNumberFieldByName = (name: string | null | undefined): boolean => !!name && NUMBER_NAME_PATTERN.test(name);

const isEmailFieldByName = (name: string | null | undefined): boolean => !!name && EMAIL_NAME_PATTERN.test(name);

const isNameFieldByName = (name: string | null | undefined): boolean => !!name && NAME_NAME_PATTERN.test(name);

const isInitialsFieldByName = (name: string | null | undefined): boolean => !!name && INITIALS_NAME_PATTERN.test(name);

/**
 * Detect AcroForm format actions on a text field dictionary.
 *
 * Adobe attaches a JavaScript format action via `/AA` → `/F` → `/JS`. The script
 * body references `AFDate_FormatEx` or `AFNumber_Format` depending on the
 * intended format. The action dict and its `/F` entry are frequently stored
 * as indirect refs in real-world PDFs, so a {@link RefResolver} MUST be
 * threaded through the lookups. We do a string-contains check on the script
 * to avoid pulling in a JS parser.
 */
const getTextFieldFormatHint = (fieldDict: PdfDict, resolver: RefResolver): 'date' | 'number' | null => {
  try {
    const formatDict = fieldDict.getDict('AA', resolver)?.getDict('F', resolver);

    if (!formatDict) {
      return null;
    }

    const js = formatDict.get('JS', resolver);

    if (!js || typeof js !== 'object') {
      return null;
    }

    let script: string;

    if (js.type === 'string') {
      script = (js as PdfString).asString();
    } else if (js.type === 'stream') {
      script = new TextDecoder().decode((js as PdfStream).getDecodedData());
    } else {
      return null;
    }

    if (script.includes('AFDate_FormatEx') || script.includes('AFDate_Format')) {
      return 'date';
    }

    if (script.includes('AFNumber_Format')) {
      return 'number';
    }

    return null;
  } catch {
    return null;
  }
};

type FormFieldWithDict = {
  name: string;
  partialName: string;
  alternateName: string | null;
  isReadOnly(): boolean;
  isRequired(): boolean;
  acroField(): PdfDict;
  getWidgets(): WidgetAnnotation[];
};

type ResolvedTextDocumensoType =
  | typeof FieldType.TEXT
  | typeof FieldType.DATE
  | typeof FieldType.NUMBER
  | typeof FieldType.EMAIL
  | typeof FieldType.NAME
  | typeof FieldType.INITIALS;

const resolveTextSubtype = (
  field: FormFieldWithDict,
  resolver: RefResolver,
): {
  documensoType: ResolvedTextDocumensoType;
} => {
  const candidateNames = [field.partialName, field.alternateName];

  const formatHint = getTextFieldFormatHint(field.acroField(), resolver);

  // AcroForm format actions take precedence over name tokens — Adobe set them
  // explicitly, so they're a stronger signal than a heuristic regex hit.
  if (formatHint === 'date') {
    return { documensoType: FieldType.DATE };
  }

  if (formatHint === 'number') {
    return { documensoType: FieldType.NUMBER };
  }

  const maxLen = field.acroField().getNumber('MaxLen', resolver)?.value ?? Number.POSITIVE_INFINITY;

  if (candidateNames.some(isDateFieldByName)) {
    return { documensoType: FieldType.DATE };
  }

  if (maxLen <= 10 && candidateNames.some(isNumberFieldByName)) {
    return { documensoType: FieldType.NUMBER };
  }

  if (candidateNames.some(isEmailFieldByName)) {
    return { documensoType: FieldType.EMAIL };
  }

  if (candidateNames.some(isNameFieldByName)) {
    return { documensoType: FieldType.NAME };
  }

  if (candidateNames.some(isInitialsFieldByName)) {
    return { documensoType: FieldType.INITIALS };
  }

  return { documensoType: FieldType.TEXT };
};

const pickLabel = (field: FormFieldWithDict): string | undefined => {
  // /TU is the human-facing tooltip/label; /T is the internal field identifier.
  return field.alternateName || undefined;
};

type RotationDegrees = 0 | 90 | 180 | 270;

type RawRect = { x1: number; y1: number; x2: number; y2: number };

const getRectFromWidget = (widget: WidgetAnnotation): RawRect | null => {
  const rect = widget.rect;

  if (!rect || rect.length !== 4) {
    return null;
  }

  const [x1, y1, x2, y2] = rect;

  if (![x1, y1, x2, y2].every((v) => Number.isFinite(v))) {
    return null;
  }

  return { x1, y1, x2, y2 };
};

const resolveGeometry = (
  widget: WidgetAnnotation,
  pageIndex: number,
  page: PDFPage,
): { geometry: ResolvedGeometry | null; reason: AcroFormUnsupportedReason | null } => {
  const rect = getRectFromWidget(widget);

  if (!rect) {
    return { geometry: null, reason: 'zero-size' };
  }

  const xL = Math.min(rect.x1, rect.x2);
  const xR = Math.max(rect.x1, rect.x2);
  const yB = Math.min(rect.y1, rect.y2);
  const yT = Math.max(rect.y1, rect.y2);

  if (xR - xL <= 0 || yT - yB <= 0) {
    return { geometry: null, reason: 'zero-size' };
  }

  const mediaBox = page.getMediaBox();
  const mediaW = mediaBox.width;
  const mediaH = mediaBox.height;
  const rotation = page.rotation as RotationDegrees;

  // PDFPage.width / .height return rotation-adjusted dimensions, which is what
  // we want for percent-based positioning relative to the rendered page.
  const renderedW = page.width;
  const renderedH = page.height;

  let renderedX: number;
  let renderedY: number;
  let renderedFieldW: number;
  let renderedFieldH: number;

  if (rotation === 90) {
    renderedX = yB;
    renderedY = xL;
    renderedFieldW = yT - yB;
    renderedFieldH = xR - xL;
  } else if (rotation === 180) {
    renderedX = mediaW - xR;
    renderedY = yB;
    renderedFieldW = xR - xL;
    renderedFieldH = yT - yB;
  } else if (rotation === 270) {
    renderedX = mediaH - yT;
    renderedY = mediaW - xR;
    renderedFieldW = yT - yB;
    renderedFieldH = xR - xL;
  } else {
    renderedX = xL;
    renderedY = mediaH - yT;
    renderedFieldW = xR - xL;
    renderedFieldH = yT - yB;
  }

  // Out-of-bounds: skip if the entire rect is outside the rendered page bounds.
  const left = renderedX;
  const right = renderedX + renderedFieldW;
  const top = renderedY;
  const bottom = renderedY + renderedFieldH;

  if (right <= 0 || left >= renderedW || bottom <= 0 || top >= renderedH) {
    return { geometry: null, reason: 'off-page' };
  }

  // Partial out-of-bounds: clamp.
  const clampedLeft = Math.max(0, Math.min(left, renderedW));
  const clampedRight = Math.max(0, Math.min(right, renderedW));
  const clampedTop = Math.max(0, Math.min(top, renderedH));
  const clampedBottom = Math.max(0, Math.min(bottom, renderedH));

  const clampedW = clampedRight - clampedLeft;
  const clampedH = clampedBottom - clampedTop;

  if (clampedW <= 0 || clampedH <= 0) {
    return { geometry: null, reason: 'off-page' };
  }

  return {
    geometry: {
      page: pageIndex + 1,
      x: clampedLeft,
      y: clampedTop,
      width: clampedW,
      height: clampedH,
      pageWidth: renderedW,
      pageHeight: renderedH,
    },
    reason: null,
  };
};

const buildSignatureFieldAndMeta = (field: FormFieldWithDict): TFieldAndMeta => {
  return ZEnvelopeFieldAndMetaSchema.parse({
    type: FieldType.SIGNATURE,
    fieldMeta: {
      ...FIELD_SIGNATURE_META_DEFAULT_VALUES,
      required: field.isRequired() || undefined,
      readOnly: field.isReadOnly() || undefined,
      source: ACROFORM_FIELD_SOURCE,
    },
  });
};

const buildTextFieldAndMeta = (
  field: FormFieldWithDict,
  documensoType: ResolvedTextDocumensoType,
  defaultText: string | undefined,
): TFieldAndMeta => {
  const label = pickLabel(field);
  const required = field.isRequired() || undefined;
  const readOnly = field.isReadOnly() || undefined;

  const defaultValue = defaultText && defaultText.length > 0 ? defaultText : undefined;
  if (documensoType === FieldType.NUMBER) {
    const fieldMeta: TNumberFieldMeta = {
      ...FIELD_NUMBER_META_DEFAULT_VALUES,
      label: label ?? FIELD_NUMBER_META_DEFAULT_VALUES.label,
      required,
      readOnly,
      source: ACROFORM_FIELD_SOURCE,
      value: defaultValue,
    };

    return ZEnvelopeFieldAndMetaSchema.parse({ type: documensoType, fieldMeta });
  }

  if (documensoType === FieldType.TEXT) {
    const fieldMeta: TTextFieldMeta = {
      ...FIELD_TEXT_META_DEFAULT_VALUES,
      label: label ?? FIELD_TEXT_META_DEFAULT_VALUES.label,
      required,
      readOnly,
      source: ACROFORM_FIELD_SOURCE,
      text: defaultValue ?? FIELD_TEXT_META_DEFAULT_VALUES.text,
    };

    return ZEnvelopeFieldAndMetaSchema.parse({ type: documensoType, fieldMeta });
  }

  if (documensoType === FieldType.DATE) {
    return ZEnvelopeFieldAndMetaSchema.parse({
      type: documensoType,
      fieldMeta: {
        ...FIELD_DATE_META_DEFAULT_VALUES,
        label,
        required,
        readOnly,
        source: ACROFORM_FIELD_SOURCE,
      },
    });
  }

  if (documensoType === FieldType.EMAIL) {
    return ZEnvelopeFieldAndMetaSchema.parse({
      type: documensoType,
      fieldMeta: {
        ...FIELD_EMAIL_META_DEFAULT_VALUES,
        label,
        required,
        readOnly,
        source: ACROFORM_FIELD_SOURCE,
      },
    });
  }

  if (documensoType === FieldType.NAME) {
    return ZEnvelopeFieldAndMetaSchema.parse({
      type: documensoType,
      fieldMeta: {
        ...FIELD_NAME_META_DEFAULT_VALUES,
        label,
        required,
        readOnly,
        source: ACROFORM_FIELD_SOURCE,
      },
    });
  }

  return ZEnvelopeFieldAndMetaSchema.parse({
    type: documensoType,
    fieldMeta: {
      ...FIELD_INITIALS_META_DEFAULT_VALUES,
      label,
      required,
      readOnly,
      source: ACROFORM_FIELD_SOURCE,
    },
  });
};

const buildCheckboxFieldAndMeta = (
  field: FormFieldWithDict,
  onValue: string | undefined,
  isChecked: boolean,
): TFieldAndMeta => {
  const required = field.isRequired();
  const value = onValue && onValue.length > 0 ? onValue : 'Yes';

  const fieldMeta: TCheckboxFieldMeta = {
    ...FIELD_CHECKBOX_META_DEFAULT_VALUES,
    label: pickLabel(field) ?? FIELD_CHECKBOX_META_DEFAULT_VALUES.label,
    required: required || undefined,
    readOnly: field.isReadOnly() || undefined,
    source: ACROFORM_FIELD_SOURCE,
    values: [{ id: 1, checked: isChecked, value }],
    validationRule: required ? 'at-least' : '',
    validationLength: required ? 1 : 0,
  };

  return ZEnvelopeFieldAndMetaSchema.parse({ type: FieldType.CHECKBOX, fieldMeta });
};

const buildRadioFieldAndMeta = (
  field: FormFieldWithDict,
  options: string[],
  selectedValue: string | null,
  widgetOnValue: string | null,
): TFieldAndMeta => {
  const values =
    options.length > 0
      ? options.map((value, index) => ({
          id: index + 1,
          checked: selectedValue !== null && value === selectedValue,
          value,
        }))
      : [
          {
            id: 1,
            checked: widgetOnValue !== null && widgetOnValue === selectedValue,
            value: widgetOnValue ?? '',
          },
        ];

  const fieldMeta: TRadioFieldMeta = {
    ...FIELD_RADIO_META_DEFAULT_VALUES,
    label: pickLabel(field) ?? '',
    required: field.isRequired() || undefined,
    readOnly: field.isReadOnly() || undefined,
    source: ACROFORM_FIELD_SOURCE,
    values,
  };

  return ZEnvelopeFieldAndMetaSchema.parse({ type: FieldType.RADIO, fieldMeta });
};

const buildDropdownFieldAndMeta = (
  field: FormFieldWithDict,
  options: string[],
  defaultValue: string | undefined,
): TFieldAndMeta => {
  const fieldMeta: TDropdownFieldMeta = {
    ...FIELD_DROPDOWN_META_DEFAULT_VALUES,
    label: pickLabel(field) ?? '',
    required: field.isRequired() || undefined,
    readOnly: field.isReadOnly() || undefined,
    source: ACROFORM_FIELD_SOURCE,
    values: options.length > 0 ? options.map((value) => ({ value })) : FIELD_DROPDOWN_META_DEFAULT_VALUES.values,
    defaultValue: defaultValue ?? '',
  };

  return ZEnvelopeFieldAndMetaSchema.parse({ type: FieldType.DROPDOWN, fieldMeta });
};

type WidgetWithPage = { widget: WidgetAnnotation; pageIndex: number; page: PDFPage };

const resolveWidgetPages = (
  widgets: WidgetAnnotation[],
  pageByRef: Map<PdfRef, { index: number; page: PDFPage }>,
): {
  matched: WidgetWithPage[];
  unmatched: WidgetAnnotation[];
} => {
  const matched: WidgetWithPage[] = [];
  const unmatched: WidgetAnnotation[] = [];

  for (const widget of widgets) {
    const pageRef = widget.pageRef;
    const resolved = pageRef ? pageByRef.get(pageRef) : null;

    if (!resolved) {
      unmatched.push(widget);
      continue;
    }

    matched.push({ widget, pageIndex: resolved.index, page: resolved.page });
  }

  return { matched, unmatched };
};

export type ExtractAcroFormOptions = {
  /**
   * When true, `insertFormValuesInPdf` already ran for this buffer. The
   * extractor will not copy AcroForm default values into `fieldMeta` to
   * avoid duplicating values that are already baked into the flattened PDF.
   */
  formValuesProvided?: boolean;
};

/**
 * Extract AcroForm fields from a PDF and convert them to Documenso field
 * imports.
 *
 * Runs before flattening so widget geometry is still present in the buffer.
 * Returns an empty result for non-AcroForm PDFs, encrypted PDFs, pure XFA forms
 * with no AcroForm widgets, and on any internal error (with `skipReason` set so
 * callers can log).
 */
export const extractAcroFormFieldsFromPDF = async (
  pdf: Buffer,
  options: ExtractAcroFormOptions = {},
): Promise<AcroFormExtractionResult> => {
  try {
    const pdfDoc = await PDF.load(new Uint8Array(pdf));

    if (pdfDoc.isEncrypted) {
      return EMPTY_RESULT('encrypted');
    }

    const resolver = makeResolver(pdfDoc);

    const hasXfaForm = hasXfa(pdfDoc, resolver);
    const form = pdfDoc.getForm();

    if (!form) {
      return EMPTY_RESULT(hasXfaForm ? 'xfa-hybrid' : 'no-form');
    }

    const formFields = form.getFields();

    if (hasXfaForm && formFields.length === 0) {
      return EMPTY_RESULT('xfa-hybrid');
    }

    const pages = pdfDoc.getPages();
    const pageByRef = new Map<PdfRef, { index: number; page: PDFPage }>();

    pages.forEach((page, index) => {
      pageByRef.set(page.ref, { index, page });
    });

    const fields: AcroFormFieldImportInfo[] = [];
    const unsupported: AcroFormUnsupportedFieldInfo[] = [];
    let hasSignedSignature = false;
    const usePdfDefaults = !options.formValuesProvided;
    const addUnsupported = (fieldName: string, acroFormType: string, reason: AcroFormUnsupportedReason): void => {
      unsupported.push({ fieldName, acroFormType, reason });
    };

    for (const field of formFields) {
      const acroFormType = field.type;

      if (
        acroFormType === 'listbox' ||
        acroFormType === 'button' ||
        acroFormType === 'unknown' ||
        acroFormType === 'non-terminal'
      ) {
        addUnsupported(field.name, acroFormType, 'unsupported-type');
        continue;
      }

      // Signed signature widgets are skipped entirely and the caller is asked
      // to keep the form intact (no flatten) so the signature stays valid.
      if (acroFormType === 'signature') {
        type SignatureFieldDuck = FormFieldWithDict & { isSigned(): boolean };
        const sigField = field as unknown as SignatureFieldDuck;

        if (typeof sigField.isSigned === 'function' && sigField.isSigned()) {
          hasSignedSignature = true;
          addUnsupported(field.name, acroFormType, 'signed-signature');
          continue;
        }
      }

      const formField = field as unknown as FormFieldWithDict;
      const widgets = formField.getWidgets();
      const { matched, unmatched } = resolveWidgetPages(widgets, pageByRef);

      for (let i = 0; i < unmatched.length; i += 1) {
        addUnsupported(field.name, acroFormType, 'no-page-match');
      }

      let widgetCounter = 0;

      for (const { widget, pageIndex, page } of matched) {
        if (widget.isHidden()) {
          addUnsupported(field.name, acroFormType, 'hidden');
          continue;
        }

        const { geometry, reason } = resolveGeometry(widget, pageIndex, page);

        if (!geometry) {
          addUnsupported(field.name, acroFormType, reason ?? 'zero-size');
          continue;
        }

        let fieldAndMeta: TFieldAndMeta;

        if (acroFormType === 'signature') {
          fieldAndMeta = buildSignatureFieldAndMeta(formField);
        } else if (acroFormType === 'text') {
          type TextFieldDuck = FormFieldWithDict & {
            getValue(): string;
            getDefaultValue(): string;
          };
          const textField = field as unknown as TextFieldDuck;
          const { documensoType } = resolveTextSubtype(formField, resolver);
          const defaultText = usePdfDefaults ? textField.getValue?.() || textField.getDefaultValue?.() || '' : '';
          fieldAndMeta = buildTextFieldAndMeta(formField, documensoType, defaultText);
        } else if (acroFormType === 'checkbox') {
          type CheckboxFieldDuck = FormFieldWithDict & {
            isChecked(): boolean;
            getOnValue(): string;
          };
          const checkbox = field as unknown as CheckboxFieldDuck;
          const onValue = widget.getOnValue() ?? checkbox.getOnValue?.();
          const checked = usePdfDefaults ? (checkbox.isChecked?.() ?? false) : false;
          fieldAndMeta = buildCheckboxFieldAndMeta(formField, onValue ?? undefined, checked);
        } else if (acroFormType === 'radio') {
          type RadioFieldDuck = FormFieldWithDict & {
            getOptions(): string[];
            getValue(): string | null;
          };
          const radio = field as unknown as RadioFieldDuck;
          const selectedValue = usePdfDefaults ? (radio.getValue?.() ?? null) : null;
          fieldAndMeta = buildRadioFieldAndMeta(
            formField,
            radio.getOptions?.() ?? [],
            selectedValue,
            widget.getOnValue(),
          );
        } else if (acroFormType === 'dropdown') {
          type DropdownFieldDuck = FormFieldWithDict & {
            getOptions(): Array<{ value: string; display: string }>;
            getValue(): string;
            getDefaultValue(): string;
          };
          const dropdown = field as unknown as DropdownFieldDuck;
          const rawOptions = dropdown.getOptions?.() ?? [];
          const optionValues = rawOptions.map((opt) => opt.value);
          const currentSelection = usePdfDefaults ? dropdown.getValue?.() || dropdown.getDefaultValue?.() || '' : '';
          fieldAndMeta = buildDropdownFieldAndMeta(formField, optionValues, currentSelection || undefined);
        } else {
          addUnsupported(field.name, acroFormType, 'unsupported-type');
          continue;
        }

        fields.push({
          source: ACROFORM_FIELD_SOURCE,
          fieldName: field.name,
          widgetIndex: widgetCounter,
          fieldAndMeta,
          page: geometry.page,
          x: geometry.x,
          y: geometry.y,
          width: geometry.width,
          height: geometry.height,
          pageWidth: geometry.pageWidth,
          pageHeight: geometry.pageHeight,
        });

        widgetCounter += 1;
      }
    }

    return {
      fields,
      unsupported,
      hasSignedSignature,
    };
  } catch (err) {
    logger.error({ event: 'acroform-import.error', err }, 'AcroForm extraction threw');

    return EMPTY_RESULT('error');
  }
};

const sortFieldsForCreate = (fields: AcroFormFieldImportInfo[]): AcroFormFieldImportInfo[] => {
  return [...fields].sort((a, b) => {
    if (a.page !== b.page) {
      return a.page - b.page;
    }

    const aRowPercent = (a.y / a.pageHeight) * 100;
    const bRowPercent = (b.y / b.pageHeight) * 100;

    if (Math.abs(aRowPercent - bRowPercent) > ROW_TOLERANCE_PERCENT) {
      return aRowPercent - bRowPercent;
    }

    return a.x - b.x;
  });
};

/**
 * Convert pre-extracted AcroForm fields to field creation inputs.
 *
 * Pure data transform — converts points to percentages and resolves the
 * recipient via the provided callback. No DB calls.
 */
export const convertAcroFormFieldsToFieldInputs = (
  fields: AcroFormFieldImportInfo[],
  recipientResolver: (fieldName: string) => Pick<Recipient, 'id'>,
  envelopeItemId?: string,
): FieldToCreate[] => {
  return sortFieldsForCreate(fields).map((f) => {
    const xPercent = (f.x / f.pageWidth) * 100;
    const yPercent = (f.y / f.pageHeight) * 100;
    const widthPercent = (f.width / f.pageWidth) * 100;
    const heightPercent = (f.height / f.pageHeight) * 100;

    const finalHeightPercent = heightPercent > MIN_HEIGHT_THRESHOLD ? heightPercent : DEFAULT_FIELD_HEIGHT_PERCENT;

    const recipient = recipientResolver(f.fieldName);

    return {
      ...f.fieldAndMeta,
      envelopeItemId,
      recipientId: recipient.id,
      page: f.page,
      positionX: xPercent,
      positionY: yPercent,
      width: widthPercent,
      height: finalHeightPercent,
    };
  });
};
