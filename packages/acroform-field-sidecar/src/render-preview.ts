import fs from 'node:fs/promises';
import path from 'node:path';

import { PDF, StandardFonts, rgb } from '@libpdf/core';

import type {
  TDocumensoFieldTemplate,
  TDocumensoFieldTemplateField,
  TFieldSpec,
  TRectDocumenso,
  TResolvedField,
} from './schemas.ts';

export type TPreviewStyleKind = 'imported' | 'skipped' | 'candidate' | 'unresolved';

export type TPreviewBox = {
  kind: TPreviewStyleKind;
  label: string;
  page: number;
  rectDocumenso: TRectDocumenso;
};

export type TRenderPreviewOptions = {
  inputPath: string;
  templatePath: string;
  fieldSpecPath: string;
  outputPath: string;
};

export type TPreviewPdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const PREVIEW_STYLES: Record<
  TPreviewStyleKind,
  {
    borderColor: ReturnType<typeof rgb>;
    labelColor: ReturnType<typeof rgb>;
    borderWidth: number;
  }
> = {
  imported: {
    borderColor: rgb(22 / 255, 163 / 255, 74 / 255),
    labelColor: rgb(22 / 255, 101 / 255, 52 / 255),
    borderWidth: 1.8,
  },
  skipped: {
    borderColor: rgb(107 / 255, 114 / 255, 128 / 255),
    labelColor: rgb(75 / 255, 85 / 255, 99 / 255),
    borderWidth: 0.6,
  },
  candidate: {
    borderColor: rgb(217 / 255, 119 / 255, 6 / 255),
    labelColor: rgb(146 / 255, 64 / 255, 14 / 255),
    borderWidth: 1.1,
  },
  unresolved: {
    borderColor: rgb(220 / 255, 38 / 255, 38 / 255),
    labelColor: rgb(153 / 255, 27 / 255, 27 / 255),
    borderWidth: 1.3,
  },
};

const clampLabel = (label: string) => (label.length > 72 ? `${label.slice(0, 69)}...` : label);

const getPageDimensions = (page: unknown) => {
  const candidate = page as {
    getSize?: () => { width: number; height: number };
    getCropBox?: () => { width: number; height: number };
    width?: number;
    height?: number;
  };

  if (candidate.getSize) {
    return candidate.getSize();
  }

  if (candidate.getCropBox) {
    return candidate.getCropBox();
  }

  if (typeof candidate.width === 'number' && typeof candidate.height === 'number') {
    return {
      width: candidate.width,
      height: candidate.height,
    };
  }

  throw new Error('Could not determine PDF page dimensions');
};

export const documensoRectToPdfRect = (
  rectDocumenso: TRectDocumenso,
  pageWidth: number,
  pageHeight: number,
): TPreviewPdfRect => {
  const width = pageWidth * (rectDocumenso.width / 100);
  const height = pageHeight * (rectDocumenso.height / 100);
  const x = pageWidth * (rectDocumenso.positionX / 100);
  const yFromTop = pageHeight * (rectDocumenso.positionY / 100);

  return {
    x,
    y: pageHeight - yFromTop - height,
    width,
    height,
  };
};

const getPreviewKindForResolvedField = (field: TResolvedField): TPreviewStyleKind => {
  if (field.generationRole === 'unresolved') {
    return 'unresolved';
  }

  if (field.classification === 'overlay-candidate') {
    return 'candidate';
  }

  return 'skipped';
};

export const getPreviewLabel = (box: Pick<TPreviewBox, 'kind' | 'label'>) => {
  if (box.kind === 'imported') {
    return `IMPORTED ${box.label}`;
  }

  if (box.kind === 'candidate') {
    return `CANDIDATE ${box.label}`;
  }

  if (box.kind === 'unresolved') {
    return `UNRESOLVED ${box.label}`;
  }

  return `SKIPPED ${box.label}`;
};

const templateFieldToPreviewBox = (field: TDocumensoFieldTemplateField): TPreviewBox => ({
  kind: 'imported',
  label: `${field.type} ${field.bindingKey}`,
  page: field.page,
  rectDocumenso: {
    positionX: field.positionX,
    positionY: field.positionY,
    width: field.width,
    height: field.height,
  },
});

const resolvedFieldToPreviewBox = (field: TResolvedField): TPreviewBox => {
  const kind = getPreviewKindForResolvedField(field);

  return {
    kind,
    label:
      kind === 'candidate'
        ? (field.semanticKey ?? field.sourceKey)
        : `${field.classification} ${field.semanticKey ?? field.sourceKey}`,
    page: field.page,
    rectDocumenso: field.rectDocumenso,
  };
};

const buildPreviewBoxes = (template: TDocumensoFieldTemplate, fieldSpec: TFieldSpec): TPreviewBox[] => [
  ...fieldSpec.fields
    .filter((field) => field.generationRole !== 'overlay-generated')
    .map(resolvedFieldToPreviewBox),
  ...template.fields.map(templateFieldToPreviewBox),
];

export const renderPreviewPdf = async ({
  inputPath,
  templatePath,
  fieldSpecPath,
  outputPath,
}: TRenderPreviewOptions) => {
  const [pdfBytes, template, fieldSpec] = await Promise.all([
    fs.readFile(inputPath),
    fs.readFile(templatePath, 'utf8').then((value) => JSON.parse(value) as TDocumensoFieldTemplate),
    fs.readFile(fieldSpecPath, 'utf8').then((value) => JSON.parse(value) as TFieldSpec),
  ]);
  const pdf = await PDF.load(pdfBytes);
  const pages = pdf.getPages();
  const boxes = buildPreviewBoxes(template, fieldSpec);

  for (const box of boxes) {
    const page = pages[box.page - 1];

    if (!page) {
      throw new Error(`Preview box ${box.label} references missing page ${box.page}`);
    }

    const { width: pageWidth, height: pageHeight } = getPageDimensions(page);
    const rect = documensoRectToPdfRect(box.rectDocumenso, pageWidth, pageHeight);
    const style = PREVIEW_STYLES[box.kind];
    const label = clampLabel(getPreviewLabel(box));
    const labelY = Math.min(pageHeight - 10, rect.y + rect.height + 2);

    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      borderColor: style.borderColor,
      borderWidth: style.borderWidth,
    });

    page.drawText(label, {
      x: rect.x,
      y: labelY,
      size: 5.5,
      font: StandardFonts.Helvetica,
      color: style.labelColor,
    });
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, await pdf.save());

  return {
    outputPath,
    boxCount: boxes.length,
    importedCount: boxes.filter((box) => box.kind === 'imported').length,
    skippedCount: boxes.filter((box) => box.kind === 'skipped').length,
    candidateCount: boxes.filter((box) => box.kind === 'candidate').length,
    unresolvedCount: boxes.filter((box) => box.kind === 'unresolved').length,
  };
};

export const getPreviewStyleKind = getPreviewKindForResolvedField;
