import fs from 'node:fs/promises';
import path from 'node:path';

import { buildOverlayPlan } from './build-overlay-plan.ts';
import { extractAcroformInventory } from './extract-acroform.ts';
import { bindDocumensoPayload, renderDocumensoFieldTemplate, renderSamplePayload } from './render-documenso-payload.ts';
import {
  getDefaultInputPdfPath,
  getDefaultOutputDir,
  getDefaultPolicyPath,
  toStableJson,
  type TBindings,
  type TDocumensoFieldTemplate,
  type TFieldSpec,
  type TValidationMode,
  validateWithDocumensoSchemasIfAvailable,
} from './schemas.ts';
import { loadPolicy, resolveSemantics } from './resolve-semantics.ts';

type TCommand = 'inspect' | 'generate' | 'bind-payload' | 'render-preview';

type TArgs = {
  command: TCommand;
  inputPath: string;
  outputDir: string;
  policyPath: string;
  templatePath: string;
  fieldSpecPath: string;
  bindingsPath: string;
  previewOutputPath: string;
};

const resolveArgs = (): TArgs => {
  const [, , commandValue, ...rest] = process.argv;
  const command = commandValue as TCommand;

  if (
    command !== 'inspect' &&
    command !== 'generate' &&
    command !== 'bind-payload' &&
    command !== 'render-preview'
  ) {
    throw new Error(
      'Usage: cli.ts <inspect|generate|bind-payload|render-preview> [--input path] [--out-dir path] [--policy path] [--template path] [--field-spec path] [--bindings path] [--out path]',
    );
  }

  const args = new Map<string, string>();

  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];

    if (key?.startsWith('--') && value) {
      args.set(key.slice(2), value);
    }
  }

  return {
    command,
    inputPath: path.resolve(args.get('input') ?? getDefaultInputPdfPath()),
    outputDir: path.resolve(args.get('out-dir') ?? getDefaultOutputDir()),
    policyPath: path.resolve(args.get('policy') ?? getDefaultPolicyPath()),
    templatePath: path.resolve(
      args.get('template') ?? path.join(getDefaultOutputDir(), 'documenso-field-template.json'),
    ),
    fieldSpecPath: path.resolve(args.get('field-spec') ?? path.join(getDefaultOutputDir(), 'field-spec.json')),
    bindingsPath: path.resolve(
      args.get('bindings') ?? path.join(getDefaultOutputDir(), 'bindings.sample.json'),
    ),
    previewOutputPath: path.resolve(
      args.get('out') ?? path.join(getDefaultOutputDir(), 'acroform-field-preview.pdf'),
    ),
  };
};

const writeFile = async (filePath: string, contents: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
};

const buildReport = (
  inputPath: string,
  spec: TFieldSpec,
  policyPath: string,
  validationMode: TValidationMode,
) => {
  const counts = {
    total: spec.fields.length,
    text: spec.fields.filter((field) => field.rawType === 'Tx').length,
    button: spec.fields.filter((field) => field.rawType === 'Btn').length,
    unresolved: spec.unresolved.length,
    overlayManual: spec.overlayPlan.filter((field) => field.generationRole === 'overlay-manual').length,
    policyOverrides: spec.fields.filter((field) =>
      field.evidence.some((evidence) => evidence.startsWith('policy override applied')),
    ).length,
  };
  const maintenanceRisky = counts.policyOverrides > 10 || counts.overlayManual > 3;
  const verdict = maintenanceRisky
    ? 'maintenance-risky, compare back to Option A'
    : 'Option B still looks maintainable and remains preferred';

  return [
    '# AcroForm Field Sidecar Report',
    '',
    `- Input PDF: \`${inputPath}\``,
    `- Policy: \`${policyPath}\``,
    `- PDF SHA-256: \`${spec.source.sha256}\``,
    `- Extraction method: \`${spec.source.extractionMethod}\``,
    `- Parser mode: \`${spec.source.extractionMethod}\``,
    `- Total widgets: \`${counts.total}\``,
    `- Text widgets: \`${counts.text}\``,
    `- Button widgets: \`${counts.button}\``,
    `- Unresolved fields: \`${counts.unresolved}\``,
    `- Manual overlay fields: \`${counts.overlayManual}\``,
    `- Policy override count: \`${counts.policyOverrides}\``,
    `- Payload validation mode: \`${validationMode}\``,
    '',
    '## Overlay Plan',
    ...spec.overlayPlan.map(
      (field) =>
        `- ${field.bindingKey}: ${field.type} on page ${field.page} at (${field.positionX}, ${field.positionY}) size ${field.width}x${field.height}`,
    ),
    '',
    '## Unresolved',
    ...(spec.unresolved.length > 0
      ? spec.unresolved.map((field) => `- ${field.sourceKey}: ${field.evidence.join('; ')}`)
      : ['- none']),
    '',
    '## Verdict',
    `- ${verdict}`,
  ].join('\n') + '\n';
};

const runInspect = async ({ inputPath, outputDir }: TArgs) => {
  const inventory = await extractAcroformInventory(inputPath);

  await writeFile(path.join(outputDir, 'acroform-inventory.json'), toStableJson(inventory));
};

const runGenerate = async ({ inputPath, outputDir, policyPath }: TArgs) => {
  const inventory = await extractAcroformInventory(inputPath);
  const policy = await loadPolicy(policyPath);
  const resolved = resolveSemantics(inventory, policy);
  const spec = buildOverlayPlan(resolved, policy);
  const template = renderDocumensoFieldTemplate(spec, policy);
  const samplePayload = renderSamplePayload(template, policy);
  const validationMode = await validateWithDocumensoSchemasIfAvailable(samplePayload);
  const sampleBindings: TBindings = {
    envelopeId: 'env_sample',
    envelopeType: 'TEMPLATE',
    recipientIds: {
      [policy.signerRecipientKey]: 1001,
    },
    envelopeItemIds: {
      [policy.primaryEnvelopeItemKey]: 'item_primary_pdf',
    },
  };

  await writeFile(path.join(outputDir, 'acroform-inventory.json'), toStableJson(inventory));
  await writeFile(path.join(outputDir, 'field-spec.json'), toStableJson(spec));
  await writeFile(path.join(outputDir, 'documenso-field-template.json'), toStableJson(template));
  await writeFile(path.join(outputDir, 'bindings.sample.json'), toStableJson(sampleBindings));
  await writeFile(path.join(outputDir, 'documenso-field-payload.sample.json'), toStableJson(samplePayload));
  await writeFile(path.join(outputDir, 'report.md'), buildReport(inputPath, spec, policyPath, validationMode));
};

const runBindPayload = async ({ templatePath, bindingsPath, outputDir }: TArgs) => {
  const template = JSON.parse(await fs.readFile(templatePath, 'utf8')) as TDocumensoFieldTemplate;
  const bindings = JSON.parse(await fs.readFile(bindingsPath, 'utf8')) as TBindings;
  const payload = bindDocumensoPayload(template, bindings);

  await validateWithDocumensoSchemasIfAvailable(payload);

  await writeFile(path.join(outputDir, 'documenso-field-payload.sample.json'), toStableJson(payload));
};

const runRenderPreview = async ({
  inputPath,
  templatePath,
  fieldSpecPath,
  previewOutputPath,
}: TArgs) => {
  const { renderPreviewPdf } = await import('./render-preview.ts');
  const result = await renderPreviewPdf({
    inputPath,
    templatePath,
    fieldSpecPath,
    outputPath: previewOutputPath,
  });

  console.log(
    [
      `Wrote debug preview PDF to ${result.outputPath}`,
      `Imported fields: ${result.importedCount}`,
      `Skipped fields: ${result.skippedCount}`,
      `Candidate fields: ${result.candidateCount}`,
      `Unresolved fields: ${result.unresolvedCount}`,
    ].join('\n'),
  );
};

const main = async () => {
  const args = resolveArgs();

  if (args.command === 'inspect') {
    await runInspect(args);
    return;
  }

  if (args.command === 'generate') {
    await runGenerate(args);
    return;
  }

  if (args.command === 'render-preview') {
    await runRenderPreview(args);
    return;
  }

  await runBindPayload(args);
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
