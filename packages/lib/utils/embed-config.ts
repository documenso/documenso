import type { EnvelopeEditorConfig } from '../types/envelope-editor';
import { DEFAULT_EMBEDDED_EDITOR_CONFIG } from '../types/envelope-editor';

export const PRESIGNED_ENVELOPE_ITEM_ID_PREFIX = 'PRESIGNED_';

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/**
 * Takes parsed `features` from the embedding hash and an `embeded` config,
 * and produces a complete `EnvelopeEditorConfig` with sensible embedded-mode defaults.
 *
 * Any explicitly provided feature flag overrides the embedded default.
 */
export function buildEmbeddedEditorOptions(
  features: DeepPartial<EnvelopeEditorConfig>,
  embeded: EnvelopeEditorConfig['embeded'],
): EnvelopeEditorConfig {
  return {
    embeded,
    ...buildEmbeddedFeatures(features),
  };
}

export const buildEmbeddedFeatures = (
  features: DeepPartial<EnvelopeEditorConfig>,
): EnvelopeEditorConfig => {
  return {
    general: {
      allowConfigureEnvelopeTitle:
        features.general?.allowConfigureEnvelopeTitle ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.general.allowConfigureEnvelopeTitle,
      allowUploadAndRecipientStep:
        features.general?.allowUploadAndRecipientStep ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.general.allowUploadAndRecipientStep,
      allowAddFieldsStep:
        features.general?.allowAddFieldsStep ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.general.allowAddFieldsStep,
      allowPreviewStep:
        features.general?.allowPreviewStep ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.general.allowPreviewStep,
      minimizeLeftSidebar:
        features.general?.minimizeLeftSidebar ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.general.minimizeLeftSidebar,
    },

    settings:
      features.settings !== null
        ? {
            allowConfigureSignatureTypes:
              features.settings?.allowConfigureSignatureTypes ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureSignatureTypes,
            allowConfigureLanguage:
              features.settings?.allowConfigureLanguage ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureLanguage,
            allowConfigureDateFormat:
              features.settings?.allowConfigureDateFormat ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureDateFormat,
            allowConfigureTimezone:
              features.settings?.allowConfigureTimezone ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureTimezone,
            allowConfigureRedirectUrl:
              features.settings?.allowConfigureRedirectUrl ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureRedirectUrl,
            allowConfigureDistribution:
              features.settings?.allowConfigureDistribution ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureDistribution,
          }
        : null,

    actions: {
      allowAttachments:
        features.actions?.allowAttachments ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowAttachments,
      allowDistributing:
        features.actions?.allowDistributing ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDistributing,
      allowDirectLink:
        features.actions?.allowDirectLink ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDirectLink,
      allowDuplication:
        features.actions?.allowDuplication ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDuplication,
      allowDownloadPDF:
        features.actions?.allowDownloadPDF ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDownloadPDF,
      allowDeletion:
        features.actions?.allowDeletion ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDeletion,
      allowReturnToPreviousPage:
        features.actions?.allowReturnToPreviousPage ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowReturnToPreviousPage,
    },

    envelopeItems:
      features.envelopeItems !== null
        ? {
            allowConfigureTitle:
              features.envelopeItems?.allowConfigureTitle ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.envelopeItems.allowConfigureTitle,
            allowConfigureOrder:
              features.envelopeItems?.allowConfigureOrder ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.envelopeItems.allowConfigureOrder,
            allowUpload:
              features.envelopeItems?.allowUpload ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.envelopeItems.allowUpload,
            allowDelete:
              features.envelopeItems?.allowDelete ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.envelopeItems.allowDelete,
          }
        : null,

    recipients:
      features.recipients !== null
        ? {
            allowAIDetection:
              features.recipients?.allowAIDetection ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowAIDetection,
            allowConfigureSigningOrder:
              features.recipients?.allowConfigureSigningOrder ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowConfigureSigningOrder,
            allowConfigureDictateNextSigner:
              features.recipients?.allowConfigureDictateNextSigner ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowConfigureDictateNextSigner,
            allowApproverRole:
              features.recipients?.allowApproverRole ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowApproverRole,
            allowViewerRole:
              features.recipients?.allowViewerRole ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowViewerRole,
            allowCCerRole:
              features.recipients?.allowCCerRole ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowCCerRole,
            allowAssistantRole:
              features.recipients?.allowAssistantRole ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowAssistantRole,
          }
        : null,

    fields: {
      allowAIDetection:
        features.fields?.allowAIDetection ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.fields.allowAIDetection,
    },
  };
};
