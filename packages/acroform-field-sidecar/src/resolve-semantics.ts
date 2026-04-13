import fs from 'node:fs/promises';

import type {
  TAcroformInventory,
  TClassification,
  TConfidence,
  TFieldSpec,
  TGenerationRole,
  TPolicy,
  TResolvedField,
} from './schemas.ts';

const humanizeIdentifier = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isGenericToggle = (value: string | null) => Boolean(value && /^toggle_\d+$/i.test(value));

const getDefaultClassification = (field: TAcroformInventory['fields'][number]): TClassification => {
  if (!field.rawName && !field.rawTooltip) {
    return 'unresolved';
  }

  if (field.rawType === 'Tx') {
    return /date(Year|Month|Day)$/i.test(field.rawName ?? '') ? 'overlay-candidate' : 'prefill-text';
  }

  if (field.rawType === 'Btn') {
    return 'prefill-checkbox';
  }

  if (field.rawType === 'Sig') {
    return 'signer-overlay-signature';
  }

  return 'unresolved';
};

const getDefaultGenerationRole = (classification: TClassification): TGenerationRole => {
  if (classification === 'prefill-text' || classification === 'prefill-checkbox') {
    return 'prefill-only';
  }

  if (classification === 'ignored' || classification === 'overlay-candidate') {
    return 'ignored';
  }

  if (classification === 'signer-overlay-signature' || classification === 'signer-overlay-date') {
    return 'overlay-generated';
  }

  return 'unresolved';
};

const resolveBaseSemantic = (field: TAcroformInventory['fields'][number]) => {
  if (field.rawName && !isGenericToggle(field.rawName)) {
    return {
      semanticKey: field.rawName,
      semanticLabel: field.rawTooltip ?? field.rawName,
      confidence: 'high' as const,
      evidence: [`resolved from field name ${field.rawName}`],
    };
  }

  if (field.rawTooltip) {
    return {
      semanticKey: field.rawName,
      semanticLabel: field.rawTooltip,
      confidence: 'medium' as const,
      evidence: [
        field.rawName
          ? `resolved from tooltip ${field.rawTooltip} for generic field ${field.rawName}`
          : `resolved from tooltip ${field.rawTooltip}`,
      ],
    };
  }

  return {
    semanticKey: field.rawName,
    semanticLabel: field.rawName ? humanizeIdentifier(field.rawName) : null,
    confidence: 'none' as const,
    evidence: ['semantic meaning could not be recovered from field name or tooltip'],
  };
};

export const loadPolicy = async (policyPath: string): Promise<TPolicy> =>
  JSON.parse(await fs.readFile(policyPath, 'utf8')) as TPolicy;

export const resolveSemantics = (inventory: TAcroformInventory, policy: TPolicy): TFieldSpec => {
  const fields: TResolvedField[] = inventory.fields.map((field) => {
    const baseSemantic = resolveBaseSemantic(field);
    const policyOverride = policy.fieldOverrides?.[field.sourceKey] ?? policy.fieldOverrides?.[field.rawName ?? ''];
    const classification = policyOverride?.classification ?? getDefaultClassification(field);
    const generationRole = policyOverride?.generationRole ?? getDefaultGenerationRole(classification);
    const confidence: TConfidence = policyOverride?.confidence ?? baseSemantic.confidence;
    const evidence = [...baseSemantic.evidence, ...(policyOverride?.evidence ?? [])];

    if (policyOverride) {
      evidence.push(`policy override applied for ${field.sourceKey}`);
    }

    return {
      sourceKey: field.sourceKey,
      rawName: field.rawName,
      rawType: field.rawType,
      semanticKey: policyOverride?.semanticKey ?? baseSemantic.semanticKey,
      semanticLabel: policyOverride?.semanticLabel ?? baseSemantic.semanticLabel,
      classification: baseSemantic.confidence === 'none' && !policyOverride ? 'unresolved' : classification,
      confidence,
      evidence,
      page: field.page,
      rectDocumenso: field.rectDocumenso,
      generationRole: baseSemantic.confidence === 'none' && !policyOverride ? 'unresolved' : generationRole,
    };
  });

  return {
    source: inventory.source,
    pages: inventory.pages,
    fields,
    overlayPlan: [],
    unresolved: fields.filter((field) => field.generationRole === 'unresolved'),
  };
};
