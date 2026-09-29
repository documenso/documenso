import { AppError, AppErrorCode } from '../errors/app-error';
import type { EnvelopeEditorConfig } from '../types/envelope-editor';
import { DEFAULT_EMBEDDED_EDITOR_CONFIG } from '../types/envelope-editor';

export const PRESIGNED_ENVELOPE_ITEM_ID_PREFIX = 'PRESIGNED_';

/**
 * The prefix of the temporary IDs given to contents added in the embedded
 * editor, which are only created once the envelope is saved.
 */
export const PRESIGNED_ENVELOPE_CONTENT_ID_PREFIX = 'PRESIGNED_';

/**
 * The prefix of the temporary data content IDs given to images picked in the
 * embedded editor, which are only uploaded once the envelope is saved.
 */
export const PRESIGNED_DATA_CONTENT_ID_PREFIX = 'PRESIGNED_';

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export type TPendingEmbedImageToUpload = {
  /**
   * The temporary data content ID the contents reference the image by.
   */
  id: string;
  file: File;
  index: number;
};

/**
 * Get the images picked in the embedded editor which the given contents
 * show, so they can be sent along with an embedded envelope create or update.
 *
 * Each image is held on the content showing it. Contents sharing an image
 * (e.g. a duplicated image content) share its temporary ID, so each image is
 * only uploaded once.
 *
 * Throws if a content uses a temporary ID without the image to go with it,
 * rather than silently saving the content without its image.
 */
export const getPendingEmbedImagesToUpload = (
  contents: { dataContentId: string | null; data?: File }[],
): TPendingEmbedImageToUpload[] => {
  const imagesToUpload: TPendingEmbedImageToUpload[] = [];

  for (const { dataContentId, data } of contents) {
    // No image, or one which is already uploaded.
    if (!dataContentId?.startsWith(PRESIGNED_DATA_CONTENT_ID_PREFIX)) {
      continue;
    }

    if (imagesToUpload.some((image) => image.id === dataContentId)) {
      continue;
    }

    if (!data) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Content image ${dataContentId} has no data`,
      });
    }

    imagesToUpload.push({ id: dataContentId, file: data, index: imagesToUpload.length });
  }

  return imagesToUpload;
};

/**
 * Takes parsed `features` from the embedding hash and an `embedded` config,
 * and produces a complete `EnvelopeEditorConfig` with sensible embedded-mode defaults.
 *
 * Any explicitly provided feature flag overrides the embedded default.
 */
export function buildEmbeddedEditorOptions(
  features: DeepPartial<EnvelopeEditorConfig>,
  embedded: EnvelopeEditorConfig['embedded'],
): EnvelopeEditorConfig {
  return {
    embedded,
    ...buildEmbeddedFeatures(features),
  };
}

export const buildEmbeddedFeatures = (features: DeepPartial<EnvelopeEditorConfig>): EnvelopeEditorConfig => {
  return {
    general: {
      allowConfigureEnvelopeTitle:
        features.general?.allowConfigureEnvelopeTitle ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.general.allowConfigureEnvelopeTitle,
      allowUploadAndRecipientStep:
        features.general?.allowUploadAndRecipientStep ??
        DEFAULT_EMBEDDED_EDITOR_CONFIG.general.allowUploadAndRecipientStep,
      allowAddFieldsStep:
        features.general?.allowAddFieldsStep ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.general.allowAddFieldsStep,
      allowAddContentsStep:
        features.general?.allowAddContentsStep ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.general.allowAddContentsStep,
      allowPreviewStep: features.general?.allowPreviewStep ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.general.allowPreviewStep,
      minimizeLeftSidebar:
        features.general?.minimizeLeftSidebar ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.general.minimizeLeftSidebar,
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
            allowConfigureExpirationPeriod:
              features.settings?.allowConfigureExpirationPeriod ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureExpirationPeriod,
            allowConfigureReminders:
              features.settings?.allowConfigureReminders ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureReminders,
            allowConfigureEmailSender:
              features.settings?.allowConfigureEmailSender ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureEmailSender,
            allowConfigureEmailReplyTo:
              features.settings?.allowConfigureEmailReplyTo ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.settings.allowConfigureEmailReplyTo,
          }
        : null,

    actions: {
      allowAttachments: features.actions?.allowAttachments ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowAttachments,
      allowDistributing:
        features.actions?.allowDistributing ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDistributing,
      allowDirectLink: features.actions?.allowDirectLink ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDirectLink,
      allowDuplication: features.actions?.allowDuplication ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDuplication,
      allowSaveAsTemplate:
        features.actions?.allowSaveAsTemplate ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowSaveAsTemplate,
      allowDownloadPDF: features.actions?.allowDownloadPDF ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDownloadPDF,
      allowDeletion: features.actions?.allowDeletion ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.actions.allowDeletion,
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
              features.envelopeItems?.allowUpload ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.envelopeItems.allowUpload,
            allowDelete:
              features.envelopeItems?.allowDelete ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.envelopeItems.allowDelete,
            allowReplace:
              features.envelopeItems?.allowReplace ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.envelopeItems.allowReplace,
          }
        : null,

    recipients:
      features.recipients !== null
        ? {
            allowAIDetection:
              features.recipients?.allowAIDetection ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowAIDetection,
            allowConfigureSigningOrder:
              features.recipients?.allowConfigureSigningOrder ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowConfigureSigningOrder,
            allowConfigureDictateNextSigner:
              features.recipients?.allowConfigureDictateNextSigner ??
              DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowConfigureDictateNextSigner,
            allowApproverRole:
              features.recipients?.allowApproverRole ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowApproverRole,
            allowViewerRole:
              features.recipients?.allowViewerRole ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowViewerRole,
            allowCCerRole:
              features.recipients?.allowCCerRole ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowCCerRole,
            allowAssistantRole:
              features.recipients?.allowAssistantRole ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.recipients.allowAssistantRole,
          }
        : null,

    fields: {
      allowAIDetection: features.fields?.allowAIDetection ?? DEFAULT_EMBEDDED_EDITOR_CONFIG.fields.allowAIDetection,
    },
  };
};
