import type { EnvelopeEditorConfig, TEnvelopeEditorSettings } from '../types/envelope-editor';

export const PRESIGNED_ENVELOPE_ITEM_ID_PREFIX = 'PRESIGNED_';

/**
 * Embedded-mode defaults for the editor config.
 *
 * - `general`: All true, `minimizeLeftSidebar: true`
 * - `settings`: All true
 * - `actions`: `allowAttachments: true`; everything else false (parent app controls lifecycle)
 * - `envelopeItems`: All true
 * - `recipients`: All true
 */
const EMBEDDED_DEFAULTS = {
  general: {
    allowConfigureEnvelopeTitle: true,
    allowUploadAndRecipientStep: true,
    allowAddFieldsStep: true,
    allowPreviewStep: true,
    minimizeLeftSidebar: true,
  },
  settings: {
    allowConfigureSignatureTypes: true,
    allowConfigureLanguage: true,
    allowConfigureDateFormat: true,
    allowConfigureTimezone: true,
    allowConfigureRedirectUrl: true,
    allowConfigureDistribution: true,
  },
  actions: {
    allowAttachments: true,
    allowDistributing: false,
    allowDirectLink: false,
    allowDuplication: false,
    allowDownloadPDF: false,
    allowDeletion: false,
    allowReturnToPreviousPage: false,
  },
  envelopeItems: {
    allowConfigureTitle: true,
    allowConfigureOrder: true,
    allowUpload: true,
    allowDelete: true,
  },
  recipients: {
    allowAIDetection: true,
    allowConfigureSigningOrder: true,
    allowConfigureDictateNextSigner: true,
    allowApproverRole: true,
    allowViewerRole: true,
    allowCCerRole: true,
    allowAssistantRole: true,
  },
  fields: {
    allowAIDetection: true,
  },
} as const satisfies TEnvelopeEditorSettings;

/**
 * Takes parsed `features` from the embedding hash and an `embeded` config,
 * and produces a complete `EnvelopeEditorConfig` with sensible embedded-mode defaults.
 *
 * Any explicitly provided feature flag overrides the embedded default.
 */
export function buildEditorConfigFromFeatures(
  features: TEnvelopeEditorSettings,
  embeded: EnvelopeEditorConfig['embeded'],
): EnvelopeEditorConfig {
  return {
    embeded,

    general: {
      allowConfigureEnvelopeTitle:
        features.general.allowConfigureEnvelopeTitle ??
        EMBEDDED_DEFAULTS.general.allowConfigureEnvelopeTitle,
      allowUploadAndRecipientStep:
        features.general.allowUploadAndRecipientStep ??
        EMBEDDED_DEFAULTS.general.allowUploadAndRecipientStep,
      allowAddFieldsStep:
        features.general.allowAddFieldsStep ?? EMBEDDED_DEFAULTS.general.allowAddFieldsStep,
      allowPreviewStep:
        features.general.allowPreviewStep ?? EMBEDDED_DEFAULTS.general.allowPreviewStep,
      minimizeLeftSidebar:
        features.general.minimizeLeftSidebar ?? EMBEDDED_DEFAULTS.general.minimizeLeftSidebar,
    },

    settings: {
      allowConfigureSignatureTypes:
        features.settings?.allowConfigureSignatureTypes ??
        EMBEDDED_DEFAULTS.settings.allowConfigureSignatureTypes,
      allowConfigureLanguage:
        features.settings?.allowConfigureLanguage ??
        EMBEDDED_DEFAULTS.settings.allowConfigureLanguage,
      allowConfigureDateFormat:
        features.settings?.allowConfigureDateFormat ??
        EMBEDDED_DEFAULTS.settings.allowConfigureDateFormat,
      allowConfigureTimezone:
        features.settings?.allowConfigureTimezone ??
        EMBEDDED_DEFAULTS.settings.allowConfigureTimezone,
      allowConfigureRedirectUrl:
        features.settings?.allowConfigureRedirectUrl ??
        EMBEDDED_DEFAULTS.settings.allowConfigureRedirectUrl,
      allowConfigureDistribution:
        features.settings?.allowConfigureDistribution ??
        EMBEDDED_DEFAULTS.settings.allowConfigureDistribution,
    },

    actions: {
      allowAttachments:
        features.actions.allowAttachments ?? EMBEDDED_DEFAULTS.actions.allowAttachments,
      allowDistributing:
        features.actions.allowDistributing ?? EMBEDDED_DEFAULTS.actions.allowDistributing,
      allowDirectLink:
        features.actions.allowDirectLink ?? EMBEDDED_DEFAULTS.actions.allowDirectLink,
      allowDuplication:
        features.actions.allowDuplication ?? EMBEDDED_DEFAULTS.actions.allowDuplication,
      allowDownloadPDF:
        features.actions.allowDownloadPDF ?? EMBEDDED_DEFAULTS.actions.allowDownloadPDF,
      allowDeletion: features.actions.allowDeletion ?? EMBEDDED_DEFAULTS.actions.allowDeletion,
      allowReturnToPreviousPage:
        features.actions.allowReturnToPreviousPage ??
        EMBEDDED_DEFAULTS.actions.allowReturnToPreviousPage,
    },

    envelopeItems: {
      allowConfigureTitle:
        features.envelopeItems?.allowConfigureTitle ??
        EMBEDDED_DEFAULTS.envelopeItems.allowConfigureTitle,
      allowConfigureOrder:
        features.envelopeItems?.allowConfigureOrder ??
        EMBEDDED_DEFAULTS.envelopeItems.allowConfigureOrder,
      allowUpload:
        features.envelopeItems?.allowUpload ?? EMBEDDED_DEFAULTS.envelopeItems.allowUpload,
      allowDelete:
        features.envelopeItems?.allowDelete ?? EMBEDDED_DEFAULTS.envelopeItems.allowDelete,
    },

    recipients: {
      allowAIDetection:
        features.recipients?.allowAIDetection ?? EMBEDDED_DEFAULTS.recipients.allowAIDetection,
      allowConfigureSigningOrder:
        features.recipients?.allowConfigureSigningOrder ??
        EMBEDDED_DEFAULTS.recipients.allowConfigureSigningOrder,
      allowConfigureDictateNextSigner:
        features.recipients?.allowConfigureDictateNextSigner ??
        EMBEDDED_DEFAULTS.recipients.allowConfigureDictateNextSigner,
      allowApproverRole:
        features.recipients?.allowApproverRole ?? EMBEDDED_DEFAULTS.recipients.allowApproverRole,
      allowViewerRole:
        features.recipients?.allowViewerRole ?? EMBEDDED_DEFAULTS.recipients.allowViewerRole,
      allowCCerRole:
        features.recipients?.allowCCerRole ?? EMBEDDED_DEFAULTS.recipients.allowCCerRole,
      allowAssistantRole:
        features.recipients?.allowAssistantRole ?? EMBEDDED_DEFAULTS.recipients.allowAssistantRole,
    },

    fields: {
      allowAIDetection:
        features.fields?.allowAIDetection ?? EMBEDDED_DEFAULTS.fields.allowAIDetection,
    },
  };
}
