import type {
  TBindings,
  TBoundPayload,
  TDocumensoFieldTemplate,
  TFieldSpec,
  TPolicy,
} from './schemas.ts';
import {
  assertValidBoundPayload,
  assertValidTemplate,
  getDefaultFieldMeta,
} from './schemas.ts';

const createSampleBindings = (policy: TPolicy): TBindings => ({
  envelopeId: 'env_sample',
  envelopeType: 'TEMPLATE',
  recipientIds: {
    [policy.signerRecipientKey]: 1001,
  },
  envelopeItemIds: {
    [policy.primaryEnvelopeItemKey]: 'item_primary_pdf',
  },
});

export const renderDocumensoFieldTemplate = (spec: TFieldSpec, policy: TPolicy): TDocumensoFieldTemplate => {
  const template: TDocumensoFieldTemplate = {
    profile: policy.profile,
    envelopeType: policy.envelopeType,
    fields: spec.overlayPlan.map((field) => ({
      bindingKey: field.bindingKey,
      recipientKey: field.recipientKey,
      envelopeItemKey: field.envelopeItemKey,
      type: field.type,
      page: field.page,
      positionX: field.positionX,
      positionY: field.positionY,
      width: field.width,
      height: field.height,
      fieldMeta: field.fieldMeta ?? getDefaultFieldMeta(field.type),
    })),
  };

  assertValidTemplate(template);

  return template;
};

export const bindDocumensoPayload = (
  template: TDocumensoFieldTemplate,
  bindings: TBindings,
): TBoundPayload => {
  const payload: TBoundPayload = {
    envelopeId: bindings.envelopeId,
    envelopeType: bindings.envelopeType ?? template.envelopeType,
    fields: template.fields.map((field) => {
      const recipientId = bindings.recipientIds[field.recipientKey];
      const envelopeItemId = bindings.envelopeItemIds[field.envelopeItemKey];

      if (!recipientId) {
        throw new Error(`No recipientId binding found for key ${field.recipientKey}`);
      }

      if (!envelopeItemId) {
        throw new Error(`No envelopeItemId binding found for key ${field.envelopeItemKey}`);
      }

      return {
        envelopeItemId,
        recipientId,
        type: field.type,
        page: field.page,
        positionX: field.positionX,
        positionY: field.positionY,
        width: field.width,
        height: field.height,
        fieldMeta: field.fieldMeta,
      };
    }),
  };

  assertValidBoundPayload(payload);

  return payload;
};

export const renderSamplePayload = (template: TDocumensoFieldTemplate, policy: TPolicy) =>
  bindDocumensoPayload(template, createSampleBindings(policy));
