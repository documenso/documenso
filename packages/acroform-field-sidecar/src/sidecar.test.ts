import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildOverlayPlan } from './build-overlay-plan.ts';
import { extractAcroformInventory } from './extract-acroform.ts';
import { documensoRectToPdfRect, getPreviewStyleKind, renderPreviewPdf } from './render-preview.ts';
import { bindDocumensoPayload, renderDocumensoFieldTemplate } from './render-documenso-payload.ts';
import {
  assertValidBoundPayload,
  getDefaultPolicyPath,
  toStableJson,
  type TBindings,
} from './schemas.ts';
import { loadPolicy, resolveSemantics } from './resolve-semantics.ts';

type TSyntheticPdfOptions = {
  inheritPageMediaBox?: boolean;
  widgetWithoutPageRef?: 'customerName' | 'toggle_1' | 'sampleDateYear' | 'signatureAnchor';
};

const buildSyntheticAcroformPdf = (options: TSyntheticPdfOptions = {}) => {
  const pageMediaBox = options.inheritPageMediaBox ? '' : ' /MediaBox [0 0 600 800]';
  const customerNamePageRef = options.widgetWithoutPageRef === 'customerName' ? '' : ' /P 5 0 R';
  const togglePageRef = options.widgetWithoutPageRef === 'toggle_1' ? '' : ' /P 5 0 R';
  const sampleDateYearPageRef = options.widgetWithoutPageRef === 'sampleDateYear' ? '' : ' /P 5 0 R';
  const signatureAnchorPageRef = options.widgetWithoutPageRef === 'signatureAnchor' ? '' : ' /P 5 0 R';
  const objects = [
    ['1 0', '<< /Type /Catalog /Pages 2 0 R /AcroForm 3 0 R >>'],
    ['2 0', '<< /Type /Pages /Kids [5 0 R] /Count 1 /MediaBox [0 0 600 800] >>'],
    ['3 0', '<< /Fields [4 0 R 6 0 R 7 0 R 8 0 R] >>'],
    [
      '4 0',
      `<< /Type /Annot /Subtype /Widget /FT /Tx /T (customerName) /TU (Customer name)${customerNamePageRef} /Rect [60 700 240 720] >>`,
    ],
    [
      '5 0',
      `<< /Type /Page /Parent 2 0 R${pageMediaBox} /Resources << >> /Annots [4 0 R 6 0 R 7 0 R 8 0 R] >>`,
    ],
    [
      '6 0',
      `<< /Type /Annot /Subtype /Widget /FT /Btn /T (toggle_1) /TU (Marketing consent)${togglePageRef} /Rect [60 650 72 662] >>`,
    ],
    [
      '7 0',
      `<< /Type /Annot /Subtype /Widget /FT /Tx /T (sampleDateYear) /TU (Sample date year)${sampleDateYearPageRef} /Rect [60 100 100 120] >>`,
    ],
    [
      '8 0',
      `<< /Type /Annot /Subtype /Widget /FT /Tx /T (signatureAnchor) /TU (Signature anchor)${signatureAnchorPageRef} /Rect [390 100 540 120] >>`,
    ],
  ];
  const offsets = [0];
  let body = '%PDF-1.7\n';

  for (const [ref, objectBody] of objects) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${ref} obj\n${objectBody}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return body;
};

const writeSyntheticAcroformPdf = async (options: TSyntheticPdfOptions = {}) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'acroform-field-sidecar-'));
  const inputPath = path.join(directory, 'sample-acroform-form.pdf');

  await fs.writeFile(inputPath, buildSyntheticAcroformPdf(options), 'latin1');

  return {
    directory,
    inputPath,
  };
};

describe('acroform-field-sidecar', () => {
  it('extracts the expected AcroForm inventory from a synthetic fixture', async () => {
    const { inputPath } = await writeSyntheticAcroformPdf();
    const inventory = await extractAcroformInventory(inputPath);

    expect(inventory.fields).toHaveLength(4);
    expect(inventory.fields.filter((field) => field.rawType === 'Tx')).toHaveLength(3);
    expect(inventory.fields.filter((field) => field.rawType === 'Btn')).toHaveLength(1);
    expect(new Set(inventory.fields.map((field) => field.page))).toEqual(new Set([1]));
  });

  it('normalizes coordinates deterministically for key text fields', async () => {
    const { inputPath } = await writeSyntheticAcroformPdf();
    const inventory = await extractAcroformInventory(inputPath);
    const customerNameField = inventory.fields.find((field) => field.rawName === 'customerName');

    expect(customerNameField).toBeDefined();
    expect(customerNameField?.rectDocumenso.positionX).toBeCloseTo(10, 4);
    expect(customerNameField?.rectDocumenso.positionY).toBeCloseTo(10, 4);
    expect(customerNameField?.rectDocumenso.width).toBeCloseTo(30, 4);
    expect(customerNameField?.rectDocumenso.height).toBeCloseTo(2.5, 4);
  });

  it('inherits the page MediaBox from parent Pages nodes', async () => {
    const { inputPath } = await writeSyntheticAcroformPdf({ inheritPageMediaBox: true });
    const inventory = await extractAcroformInventory(inputPath);

    expect(inventory.pages).toEqual([
      {
        pageNumber: 1,
        width: 600,
        height: 800,
      },
    ]);
    expect(inventory.fields[0]?.page).toBe(1);
  });

  it('derives widget page ownership from the page Annots array when /P is missing', async () => {
    const { inputPath } = await writeSyntheticAcroformPdf({ widgetWithoutPageRef: 'signatureAnchor' });
    const inventory = await extractAcroformInventory(inputPath);
    const signatureField = inventory.fields.find((field) => field.rawName === 'signatureAnchor');

    expect(signatureField).toBeDefined();
    expect(signatureField?.page).toBe(1);
    expect(signatureField?.rectDocumenso.positionX).toBeCloseTo(65, 4);
    expect(signatureField?.rectDocumenso.positionY).toBeCloseTo(85, 4);
  });

  it('resolves named fields from /T and generic toggles from /TU', async () => {
    const { inputPath } = await writeSyntheticAcroformPdf();
    const inventory = await extractAcroformInventory(inputPath);
    const policy = await loadPolicy(getDefaultPolicyPath());
    const spec = resolveSemantics(inventory, policy);
    const namedField = spec.fields.find((field) => field.sourceKey === 'customerName');
    const toggleField = spec.fields.find((field) => field.sourceKey === 'toggle_1');

    expect(namedField?.confidence).toBe('high');
    expect(namedField?.semanticKey).toBe('customerName');
    expect(toggleField?.confidence).toBe('medium');
    expect(toggleField?.semanticLabel).toBe('Marketing consent');
  });

  it('keeps unresolved fields explicit instead of silently coercing them', async () => {
    const { inputPath } = await writeSyntheticAcroformPdf();
    const inventory = await extractAcroformInventory(inputPath);

    inventory.fields.push({
      sourceKey: 'mysteryField',
      rawName: null,
      rawType: null,
      rawTooltip: null,
      page: 1,
      rectPdf: { x1: 0, y1: 0, x2: 1, y2: 1 },
      rectDocumenso: { positionX: 0, positionY: 0, width: 1, height: 1 },
    });

    const policy = await loadPolicy(getDefaultPolicyPath());
    const spec = resolveSemantics(inventory, policy);
    const unresolved = spec.unresolved.find((field) => field.sourceKey === 'mysteryField');

    expect(unresolved).toBeDefined();
    expect(unresolved?.generationRole).toBe('unresolved');
  });

  it('builds only the signing-layer overlay subset', async () => {
    const { inputPath } = await writeSyntheticAcroformPdf();
    const inventory = await extractAcroformInventory(inputPath);
    const policy = await loadPolicy(getDefaultPolicyPath());
    const spec = buildOverlayPlan(resolveSemantics(inventory, policy), policy);

    expect(spec.overlayPlan).toHaveLength(1);
    expect(spec.overlayPlan[0].type).toBe('SIGNATURE');
    expect(spec.overlayPlan[0].generationRole).toBe('overlay-generated');
    expect(spec.overlayPlan[0].sourceKey).toBe('signatureAnchor');
    expect(spec.overlayPlan[0].positionX).toBeCloseTo(65, 4);
    expect(spec.overlayPlan[0].positionY).toBeCloseTo(85, 4);
    expect(spec.overlayPlan[0].width).toBeCloseTo(25, 4);
    expect(spec.overlayPlan[0].height).toBeCloseTo(2.5, 4);
  });

  it('binds a valid Documenso payload', async () => {
    const { inputPath } = await writeSyntheticAcroformPdf();
    const inventory = await extractAcroformInventory(inputPath);
    const policy = await loadPolicy(getDefaultPolicyPath());
    const spec = buildOverlayPlan(resolveSemantics(inventory, policy), policy);
    const template = renderDocumensoFieldTemplate(spec, policy);
    const bindings: TBindings = {
      envelopeId: 'env_live',
      envelopeType: 'TEMPLATE',
      recipientIds: { signer: 2001 },
      envelopeItemIds: { 'primary-pdf': 'item_live' },
    };
    const payload = bindDocumensoPayload(template, bindings);

    expect(() => assertValidBoundPayload(payload)).not.toThrow();
  });

  it('is deterministic for the same PDF input', async () => {
    const { inputPath } = await writeSyntheticAcroformPdf();
    const first = await extractAcroformInventory(inputPath);
    const second = await extractAcroformInventory(inputPath);

    expect(first).toEqual(second);
  });

  it('has a valid policy file in the expected location', async () => {
    const policyPath = getDefaultPolicyPath();
    const policyContents = await fs.readFile(policyPath, 'utf8');

    expect(path.basename(policyPath)).toBe('sample-acroform.policy.json');
    expect(policyContents).toContain('"bindingKey": "signer-signature"');
  });

  it('converts Documenso percentages into PDF drawing coordinates', () => {
    const rect = documensoRectToPdfRect(
      { positionX: 10, positionY: 20, width: 30, height: 5 },
      600,
      800,
    );

    expect(rect).toEqual({
      x: 60,
      y: 600,
      width: 180,
      height: 40,
    });
  });

  it('maps preview classifications to distinct visual style kinds', () => {
    expect(
      getPreviewStyleKind({
        generationRole: 'unresolved',
        classification: 'unresolved',
      } as never),
    ).toBe('unresolved');
    expect(
      getPreviewStyleKind({
        generationRole: 'ignored',
        classification: 'overlay-candidate',
      } as never),
    ).toBe('candidate');
    expect(
      getPreviewStyleKind({
        generationRole: 'prefill-only',
        classification: 'prefill-text',
      } as never),
    ).toBe('skipped');
  });

  it('renders a debug preview PDF artifact', async () => {
    const { directory, inputPath } = await writeSyntheticAcroformPdf();
    const policy = await loadPolicy(getDefaultPolicyPath());
    const inventory = await extractAcroformInventory(inputPath);
    const spec = buildOverlayPlan(resolveSemantics(inventory, policy), policy);
    const template = renderDocumensoFieldTemplate(spec, policy);
    const templatePath = path.join(directory, 'documenso-field-template.json');
    const fieldSpecPath = path.join(directory, 'field-spec.json');
    const outputPath = path.join(directory, 'acroform-field-preview.test.pdf');

    await fs.writeFile(templatePath, toStableJson(template));
    await fs.writeFile(fieldSpecPath, toStableJson(spec));

    const result = await renderPreviewPdf({
      inputPath,
      templatePath,
      fieldSpecPath,
      outputPath,
    });
    const output = await fs.readFile(result.outputPath);

    expect(output.byteLength).toBeGreaterThan(1000);
    expect(output.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
