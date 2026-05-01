import type { TFieldSpec, TOverlayPlanField, TPolicy } from './schemas.ts';
import { getDefaultFieldMeta } from './schemas.ts';

const applyGeneratedOverlay = (spec: TFieldSpec, policy: TPolicy) => {
  const generatedOverlays = policy.generatedOverlays ?? [];

  return generatedOverlays.map<TOverlayPlanField>((overlay) => {
    const field = spec.fields.find(
      (candidate) =>
        (overlay.sourceKey && candidate.sourceKey === overlay.sourceKey) ||
        (overlay.rawName && candidate.rawName === overlay.rawName),
    );

    if (!field) {
      throw new Error(
        `Generated overlay ${overlay.bindingKey} could not find source field ${overlay.sourceKey ?? overlay.rawName}`,
      );
    }

    return {
      bindingKey: overlay.bindingKey,
      sourceKey: field.sourceKey,
      semanticKey: overlay.semanticKey ?? field.semanticKey,
      semanticLabel: overlay.semanticLabel ?? field.semanticLabel ?? overlay.bindingKey,
      classification: overlay.classification,
      confidence: field.confidence === 'none' ? 'low' : field.confidence,
      evidence: [...field.evidence, `generated overlay created from ${field.sourceKey}`],
      generationRole: 'overlay-generated',
      recipientKey: overlay.recipientKey,
      envelopeItemKey: overlay.envelopeItemKey,
      type: overlay.type,
      page: field.page,
      positionX: field.rectDocumenso.positionX,
      positionY: field.rectDocumenso.positionY,
      width: field.rectDocumenso.width,
      height: field.rectDocumenso.height,
      fieldMeta: overlay.fieldMeta ?? getDefaultFieldMeta(overlay.type),
    };
  });
};

const applyManualOverlay = (policy: TPolicy) =>
  policy.manualOverlays.map<TOverlayPlanField>((overlay) => ({
    bindingKey: overlay.bindingKey,
    sourceKey: null,
    semanticKey: overlay.semanticKey,
    semanticLabel: overlay.semanticLabel,
    classification: overlay.classification,
    confidence: 'high',
    evidence: [`manual overlay from policy for ${overlay.bindingKey}`, ...(overlay.note ? [overlay.note] : [])],
    generationRole: 'overlay-manual',
    recipientKey: overlay.recipientKey,
    envelopeItemKey: overlay.envelopeItemKey,
    type: overlay.type,
    page: overlay.page,
    positionX: overlay.positionX,
    positionY: overlay.positionY,
    width: overlay.width,
    height: overlay.height,
    fieldMeta: overlay.fieldMeta ?? getDefaultFieldMeta(overlay.type),
  }));

export const buildOverlayPlan = (spec: TFieldSpec, policy: TPolicy): TFieldSpec => {
  const overlayPlan = [...applyGeneratedOverlay(spec, policy), ...applyManualOverlay(policy)];

  if (overlayPlan.length === 0) {
    throw new Error('Overlay plan is empty; at least one signing-layer field must be generated');
  }

  const hasSignatureField = overlayPlan.some((field) => field.type === 'SIGNATURE');

  if (!hasSignatureField) {
    throw new Error('Overlay plan is missing a required SIGNATURE field');
  }

  return {
    ...spec,
    overlayPlan,
    unresolved: spec.fields.filter((field) => field.generationRole === 'unresolved'),
  };
};
