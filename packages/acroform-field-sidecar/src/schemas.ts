import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXTRACTOR_VERSION = '0.1.0';

export const FIELD_TYPES = [
  'SIGNATURE',
  'FREE_SIGNATURE',
  'INITIALS',
  'NAME',
  'EMAIL',
  'DATE',
  'TEXT',
  'NUMBER',
  'RADIO',
  'CHECKBOX',
  'DROPDOWN',
] as const;

export const CLASSIFICATIONS = [
  'prefill-text',
  'prefill-checkbox',
  'signer-overlay-signature',
  'signer-overlay-date',
  'overlay-candidate',
  'ignored',
  'unresolved',
] as const;

export const CONFIDENCE_VALUES = ['high', 'medium', 'low', 'none'] as const;

export const GENERATION_ROLES = [
  'prefill-only',
  'overlay-generated',
  'overlay-manual',
  'ignored',
  'unresolved',
] as const;

export type TDocumensoFieldType = (typeof FIELD_TYPES)[number];
export type TClassification = (typeof CLASSIFICATIONS)[number];
export type TConfidence = (typeof CONFIDENCE_VALUES)[number];
export type TGenerationRole = (typeof GENERATION_ROLES)[number];

export type TRectPdf = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type TRectDocumenso = {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export type TPageInfo = {
  pageNumber: number;
  width: number;
  height: number;
};

export type TInventoryField = {
  sourceKey: string;
  rawName: string | null;
  rawType: string | null;
  rawTooltip: string | null;
  page: number;
  rectPdf: TRectPdf;
  rectDocumenso: TRectDocumenso;
};

export type TAcroformInventory = {
  source: {
    pdfPath: string;
    sha256: string;
    extractorVersion: string;
    extractionMethod: string;
  };
  pages: TPageInfo[];
  fields: TInventoryField[];
};

export type TResolvedField = {
  sourceKey: string;
  rawName: string | null;
  rawType: string | null;
  semanticKey: string | null;
  semanticLabel: string | null;
  classification: TClassification;
  confidence: TConfidence;
  evidence: string[];
  page: number;
  rectDocumenso: TRectDocumenso;
  generationRole: TGenerationRole;
};

export type TOverlayPlanField = {
  bindingKey: string;
  sourceKey: string | null;
  semanticKey: string | null;
  semanticLabel: string;
  classification: Extract<TClassification, 'signer-overlay-signature' | 'signer-overlay-date'>;
  confidence: Exclude<TConfidence, 'none'>;
  evidence: string[];
  generationRole: Extract<TGenerationRole, 'overlay-generated' | 'overlay-manual'>;
  recipientKey: string;
  envelopeItemKey: string;
  type: Extract<TDocumensoFieldType, 'SIGNATURE' | 'DATE' | 'TEXT' | 'NAME' | 'EMAIL' | 'INITIALS'>;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  fieldMeta: Record<string, unknown> | undefined;
};

export type TFieldSpec = {
  source: TAcroformInventory['source'];
  pages: TPageInfo[];
  fields: TResolvedField[];
  overlayPlan: TOverlayPlanField[];
  unresolved: TResolvedField[];
};

export type TDocumensoFieldTemplateField = {
  bindingKey: string;
  recipientKey: string;
  envelopeItemKey: string;
  type: TDocumensoFieldType;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  fieldMeta: Record<string, unknown> | undefined;
};

export type TDocumensoFieldTemplate = {
  profile: string;
  envelopeType: 'TEMPLATE';
  fields: TDocumensoFieldTemplateField[];
};

export type TBindings = {
  envelopeId: string;
  envelopeType?: 'TEMPLATE' | 'DOCUMENT';
  recipientIds: Record<string, number>;
  envelopeItemIds: Record<string, string>;
};

export type TBoundPayload = {
  envelopeId: string;
  envelopeType: 'TEMPLATE' | 'DOCUMENT';
  fields: Array<{
    envelopeItemId: string;
    recipientId: number;
    type: TDocumensoFieldType;
    page: number;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    fieldMeta: Record<string, unknown> | undefined;
  }>;
};

export type TValidationMode = 'documenso-zod' | 'local-fallback';

export type TPolicyFieldOverride = {
  semanticKey?: string;
  semanticLabel?: string;
  classification?: TClassification;
  confidence?: TConfidence;
  generationRole?: TGenerationRole;
  evidence?: string[];
};

export type TPolicyManualOverlay = {
  bindingKey: string;
  semanticKey: string;
  semanticLabel: string;
  classification: Extract<TClassification, 'signer-overlay-signature' | 'signer-overlay-date'>;
  recipientKey: string;
  envelopeItemKey: string;
  type: Extract<TDocumensoFieldType, 'SIGNATURE' | 'DATE' | 'TEXT' | 'NAME' | 'EMAIL' | 'INITIALS'>;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  fieldMeta?: Record<string, unknown>;
  note?: string;
};

export type TPolicyGeneratedOverlay = {
  sourceKey?: string;
  rawName?: string;
  bindingKey: string;
  semanticKey?: string;
  semanticLabel?: string;
  classification: Extract<TClassification, 'signer-overlay-signature' | 'signer-overlay-date'>;
  recipientKey: string;
  envelopeItemKey: string;
  type: Extract<TDocumensoFieldType, 'SIGNATURE' | 'DATE' | 'TEXT' | 'NAME' | 'EMAIL' | 'INITIALS'>;
  fieldMeta?: Record<string, unknown>;
};

export type TPolicy = {
  profile: string;
  envelopeType: 'TEMPLATE';
  signerRecipientKey: string;
  primaryEnvelopeItemKey: string;
  fieldOverrides?: Record<string, TPolicyFieldOverride>;
  manualOverlays: TPolicyManualOverlay[];
  generatedOverlays?: TPolicyGeneratedOverlay[];
};

export const DEFAULT_FIELD_FONT_SIZE = 12;
export const DEFAULT_SIGNATURE_TEXT_FONT_SIZE = 18;

export const DEFAULT_FIELD_META_BY_TYPE: Record<TDocumensoFieldType, Record<string, unknown> | undefined> = {
  SIGNATURE: {
    type: 'signature',
    fontSize: DEFAULT_SIGNATURE_TEXT_FONT_SIZE,
  },
  FREE_SIGNATURE: undefined,
  INITIALS: {
    type: 'initials',
    fontSize: DEFAULT_FIELD_FONT_SIZE,
    textAlign: 'left',
  },
  NAME: {
    type: 'name',
    fontSize: DEFAULT_FIELD_FONT_SIZE,
    textAlign: 'left',
  },
  EMAIL: {
    type: 'email',
    fontSize: DEFAULT_FIELD_FONT_SIZE,
    textAlign: 'left',
  },
  DATE: {
    type: 'date',
    fontSize: DEFAULT_FIELD_FONT_SIZE,
    textAlign: 'left',
  },
  TEXT: {
    type: 'text',
    fontSize: DEFAULT_FIELD_FONT_SIZE,
    textAlign: 'left',
    label: '',
    placeholder: '',
    text: '',
    required: false,
    readOnly: false,
  },
  NUMBER: {
    type: 'number',
    fontSize: DEFAULT_FIELD_FONT_SIZE,
    textAlign: 'left',
    label: '',
    placeholder: '',
    required: false,
    readOnly: false,
  },
  RADIO: {
    type: 'radio',
    fontSize: DEFAULT_FIELD_FONT_SIZE,
    values: [{ id: 1, checked: false, value: '' }],
    required: false,
    readOnly: false,
    direction: 'vertical',
  },
  CHECKBOX: {
    type: 'checkbox',
    fontSize: DEFAULT_FIELD_FONT_SIZE,
    values: [{ id: 1, checked: false, value: '' }],
    validationRule: '',
    validationLength: 0,
    required: false,
    readOnly: false,
    direction: 'vertical',
  },
  DROPDOWN: {
    type: 'dropdown',
    fontSize: DEFAULT_FIELD_FONT_SIZE,
    values: [{ value: 'Option 1' }],
    defaultValue: '',
    required: false,
    readOnly: false,
  },
};

export const getRepoRoot = () => {
  const currentFile = fileURLToPath(import.meta.url);

  return path.resolve(path.dirname(currentFile), '..', '..', '..');
};

export const getDefaultInputPdfPath = () =>
  path.join(getRepoRoot(), 'artifacts', 'acroform-field-sidecar', 'canonical', 'sample-acroform-form.pdf');

export const getDefaultOutputDir = () => path.join(getRepoRoot(), 'artifacts', 'acroform-field-sidecar', 'working');

export const getDefaultPolicyPath = () =>
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'profiles', 'sample-acroform.policy.json');

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const assertCoordinate = (value: number, label: string) => {
  if (!isFiniteNumber(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be a number between 0 and 100`);
  }
};

const assertFieldType: (value: unknown) => asserts value is TDocumensoFieldType = (value) => {
  if (typeof value !== 'string' || !FIELD_TYPES.includes(value as TDocumensoFieldType)) {
    throw new Error(`Invalid Documenso field type: ${String(value)}`);
  }
};

export const getDefaultFieldMeta = (type: TDocumensoFieldType) => {
  const base = DEFAULT_FIELD_META_BY_TYPE[type];

  if (!base) {
    return undefined;
  }

  return structuredClone(base);
};

export const assertValidTemplate = (template: TDocumensoFieldTemplate) => {
  if (template.envelopeType !== 'TEMPLATE') {
    throw new Error('Template envelopeType must be TEMPLATE');
  }

  for (const field of template.fields) {
    assertFieldType(field.type);

    if (!field.bindingKey) {
      throw new Error('Template field bindingKey is required');
    }

    if (!field.recipientKey) {
      throw new Error(`Template field ${field.bindingKey} is missing recipientKey`);
    }

    if (!field.envelopeItemKey) {
      throw new Error(`Template field ${field.bindingKey} is missing envelopeItemKey`);
    }

    if (!Number.isInteger(field.page) || field.page < 1) {
      throw new Error(`Template field ${field.bindingKey} must have page >= 1`);
    }

    assertCoordinate(field.positionX, `Template field ${field.bindingKey} positionX`);
    assertCoordinate(field.positionY, `Template field ${field.bindingKey} positionY`);
    assertCoordinate(field.width, `Template field ${field.bindingKey} width`);
    assertCoordinate(field.height, `Template field ${field.bindingKey} height`);
  }
};

export const assertValidBoundPayload = (payload: TBoundPayload) => {
  if (!payload.envelopeId) {
    throw new Error('Payload envelopeId is required');
  }

  if (payload.envelopeType !== 'TEMPLATE' && payload.envelopeType !== 'DOCUMENT') {
    throw new Error('Payload envelopeType must be TEMPLATE or DOCUMENT');
  }

  for (const field of payload.fields) {
    assertFieldType(field.type);

    if (!field.envelopeItemId) {
      throw new Error('Payload field envelopeItemId is required');
    }

    if (!Number.isInteger(field.recipientId) || field.recipientId <= 0) {
      throw new Error(`Payload field recipientId must be a positive integer: ${field.recipientId}`);
    }

    if (!Number.isInteger(field.page) || field.page < 1) {
      throw new Error(`Payload field page must be >= 1: ${field.page}`);
    }

    assertCoordinate(field.positionX, `Payload field ${field.type} positionX`);
    assertCoordinate(field.positionY, `Payload field ${field.type} positionY`);
    assertCoordinate(field.width, `Payload field ${field.type} width`);
    assertCoordinate(field.height, `Payload field ${field.type} height`);
  }
};

export const validateWithDocumensoSchemasIfAvailable = async (
  payload: TBoundPayload,
): Promise<TValidationMode> => {
  try {
    const schemaModulePath = '../../trpc/server/envelope-router/set-envelope-fields.types.ts';
    const module = (await import(schemaModulePath)) as {
      ZSetEnvelopeFieldsRequestSchema: {
        parse: (payload: TBoundPayload) => unknown;
      };
    };

    module.ZSetEnvelopeFieldsRequestSchema.parse(payload);

    return 'documenso-zod';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

    if (
      code === 'ERR_MODULE_NOT_FOUND' ||
      message.includes('Cannot find package') ||
      message.includes('Cannot find module') ||
      message.includes('Failed to resolve module')
    ) {
      return 'local-fallback';
    }

    throw error;
  }
};

export const stableSortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableSortObject);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableSortObject(nestedValue)]),
    );
  }

  return value;
};

export const toStableJson = (value: unknown) => JSON.stringify(stableSortObject(value), null, 2) + '\n';
