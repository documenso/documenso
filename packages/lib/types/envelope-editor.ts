import { EnvelopeType } from '@prisma/client';
import { z } from 'zod';

import { ZBaseEmbedDataSchema } from '@documenso/lib/types/embed-base-schemas';
import { ZEnvelopeFieldSchema } from '@documenso/lib/types/field';
import { ZEnvelopeRecipientLiteSchema } from '@documenso/lib/types/recipient';
import { DocumentMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';
import { EnvelopeAttachmentSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeAttachmentSchema';
import { EnvelopeItemSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import { EnvelopeSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import { TemplateDirectLinkSchema } from '@documenso/prisma/generated/zod/modelSchema/TemplateDirectLinkSchema';

/**
 * DO NOT MAKE ANY BREAKING BACKWARD CHANGES HERE UNLESS YOU'RE SURE
 * IT WON'T BREAK EMBEDDINGS.
 *
 * Keep this in sync with the embedded repo (the types + schema)
 */
export const ZEnvelopeEditorSettingsSchema = z.object({
  /**
   * Generic editor related configurations.
   */
  general: z.object({
    allowConfigureEnvelopeTitle: z.boolean(),
    allowUploadAndRecipientStep: z.boolean(),
    allowAddFieldsStep: z.boolean(),
    allowPreviewStep: z.boolean(),
    minimizeLeftSidebar: z.boolean(),
  }),

  /**
   * Envelope meta/settings related configuration
   *
   * If null, the settings will not be available to be seen/updated.
   */
  settings: z
    .object({
      allowConfigureSignatureTypes: z.boolean(),
      allowConfigureLanguage: z.boolean(),
      allowConfigureDateFormat: z.boolean(),
      allowConfigureTimezone: z.boolean(),
      allowConfigureRedirectUrl: z.boolean(),
      allowConfigureDistribution: z.boolean(),
      allowConfigureExpirationPeriod: z.boolean(),
      allowConfigureEmailSender: z.boolean(),
      allowConfigureEmailReplyTo: z.boolean(),
    })
    .nullable(),

  /**
   * Action related configurations.
   */
  actions: z.object({
    allowAttachments: z.boolean(),
    allowDistributing: z.boolean(),
    allowDirectLink: z.boolean(),
    allowDuplication: z.boolean(),
    allowSaveAsTemplate: z.boolean(),
    allowDownloadPDF: z.boolean(),
    allowDeletion: z.boolean(),
  }),

  /**
   * Envelope items related configurations.
   *
   * If null, no adjustments to envelope items will be allowed.
   */
  envelopeItems: z
    .object({
      allowConfigureTitle: z.boolean(),
      allowConfigureOrder: z.boolean(),
      allowUpload: z.boolean(),
      allowDelete: z.boolean(),
      allowReplace: z.boolean(),
    })
    .nullable(),

  /**
   * Recipient related configurations.
   *
   * If null, recipients will not be configurable at all.
   */
  recipients: z
    .object({
      allowAIDetection: z.boolean(),
      allowConfigureSigningOrder: z.boolean(),
      allowConfigureDictateNextSigner: z.boolean(),
      allowApproverRole: z.boolean(),
      allowViewerRole: z.boolean(),
      allowCCerRole: z.boolean(),
      allowAssistantRole: z.boolean(),
    })
    .nullable(),

  /**
   * Fields related configurations.
   */
  fields: z.object({
    allowAIDetection: z.boolean(),
  }),
});

export type TEnvelopeEditorSettings = z.infer<typeof ZEnvelopeEditorSettingsSchema>;

/**
 * The default editor configuration for normal flows.
 */
export const DEFAULT_EDITOR_CONFIG: EnvelopeEditorConfig = {
  general: {
    allowConfigureEnvelopeTitle: true,
    allowUploadAndRecipientStep: true,
    allowAddFieldsStep: true,
    allowPreviewStep: true,
    minimizeLeftSidebar: false,
  },
  settings: {
    allowConfigureSignatureTypes: true,
    allowConfigureLanguage: true,
    allowConfigureDateFormat: true,
    allowConfigureTimezone: true,
    allowConfigureRedirectUrl: true,
    allowConfigureDistribution: true,
    allowConfigureExpirationPeriod: true,
    allowConfigureEmailSender: true,
    allowConfigureEmailReplyTo: true,
  },
  actions: {
    allowAttachments: true,
    allowDistributing: true,
    allowDirectLink: true,
    allowDuplication: true,
    allowSaveAsTemplate: true,
    allowDownloadPDF: true,
    allowDeletion: true,
  },
  envelopeItems: {
    allowConfigureTitle: true,
    allowConfigureOrder: true,
    allowUpload: true,
    allowDelete: true,
    allowReplace: true,
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
};

/**
 * The default configuration for the embedded editor. This is merged with whatever is provided
 * by the embedded hash.
 *
 * This is duplicated in the embedded repo playground
 *
 * /playground/src/components/embedddings/envelope-feature.ts
 */
export const DEFAULT_EMBEDDED_EDITOR_CONFIG = {
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
    allowConfigureExpirationPeriod: true,
    allowConfigureEmailSender: true,
    allowConfigureEmailReplyTo: true,
  },
  actions: {
    allowAttachments: true,
    allowDistributing: false, // These are not supported for embeds, and are directly excluded in the embedded repo.
    allowDirectLink: false, // These are not supported for embeds, and are directly excluded in the embedded repo.
    allowDuplication: false, // These are not supported for embeds, and are directly excluded in the embedded repo.
    allowSaveAsTemplate: false, // These are not supported for embeds, and are directly excluded in the embedded repo.
    allowDownloadPDF: false, // These are not supported for embeds, and are directly excluded in the embedded repo.
    allowDeletion: false, // These are not supported for embeds, and are directly excluded in the embedded repo.
  },
  envelopeItems: {
    allowConfigureTitle: true,
    allowConfigureOrder: true,
    allowUpload: true,
    allowDelete: true,
    allowReplace: true,
  },
  recipients: {
    allowAIDetection: false, // These are not supported for embeds, and are directly excluded in the embedded repo.
    allowConfigureSigningOrder: true,
    allowConfigureDictateNextSigner: true,
    allowApproverRole: true,
    allowViewerRole: true,
    allowCCerRole: true,
    allowAssistantRole: true,
  },
  fields: {
    allowAIDetection: false, // These are not supported for embeds, and are directly excluded in the embedded repo.
  },
} as const satisfies EnvelopeEditorConfig;

export const ZEmbedCreateEnvelopeAuthoringSchema = ZBaseEmbedDataSchema.extend({
  externalId: z.string().optional(),
  type: z.nativeEnum(EnvelopeType),
  folderId: z.string().optional(),
  features: z.object({}).passthrough().optional().default(DEFAULT_EMBEDDED_EDITOR_CONFIG),
});

export const ZEmbedEditEnvelopeAuthoringSchema = ZBaseEmbedDataSchema.extend({
  externalId: z.string().optional(),
  features: z.object({}).passthrough().optional().default(DEFAULT_EMBEDDED_EDITOR_CONFIG),
});

export type TEmbedCreateEnvelopeAuthoring = z.infer<typeof ZEmbedCreateEnvelopeAuthoringSchema>;
export type TEmbedEditEnvelopeAuthoring = z.infer<typeof ZEmbedEditEnvelopeAuthoringSchema>;

/**
 * A subset of the full envelope response schema used for the envelope editor.
 *
 * Internal usage only.
 */
export const ZEditorEnvelopeSchema = EnvelopeSchema.pick({
  internalVersion: true,
  type: true,
  status: true,
  source: true,
  visibility: true,
  templateType: true,
  id: true,
  secondaryId: true,
  externalId: true,
  completedAt: true,
  deletedAt: true,
  title: true,
  authOptions: true,
  publicTitle: true,
  publicDescription: true,
  userId: true,
  teamId: true,
  folderId: true,
}).extend({
  documentMeta: DocumentMetaSchema.pick({
    signingOrder: true,
    distributionMethod: true,
    id: true,
    subject: true,
    message: true,
    timezone: true,
    dateFormat: true,
    redirectUrl: true,
    typedSignatureEnabled: true,
    uploadSignatureEnabled: true,
    drawSignatureEnabled: true,
    allowDictateNextSigner: true,
    language: true,
    emailSettings: true,
    emailId: true,
    emailReplyTo: true,
    envelopeExpirationPeriod: true,
  }),
  recipients: ZEnvelopeRecipientLiteSchema.array(),
  fields: ZEnvelopeFieldSchema.array(),
  envelopeItems: EnvelopeItemSchema.pick({
    envelopeId: true,
    id: true,
    title: true,
    order: true,
    documentDataId: true,
  })
    .extend({
      // Only used for embedded.
      data: z.instanceof(Uint8Array).optional(),
    })
    .array(),
  directLink: TemplateDirectLinkSchema.pick({
    directTemplateRecipientId: true,
    enabled: true,
    id: true,
    token: true,
  }).nullable(),
  team: TeamSchema.pick({
    id: true,
    url: true,
    organisationId: true,
  }),
  user: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
  }),
  attachments: EnvelopeAttachmentSchema.pick({
    id: true,
    type: true,
    label: true,
    data: true,
  }).array(),
});

export type TEditorEnvelope = z.infer<typeof ZEditorEnvelopeSchema>;

export type EnvelopeEditorConfig = TEnvelopeEditorSettings & {
  embedded?: {
    presignToken: string;
    mode: 'create' | 'edit';
    onCreate?: (envelope: Omit<TEditorEnvelope, 'id'>) => void;
    onUpdate?: (envelope: TEditorEnvelope) => void;
    customBrandingLogo?: boolean;
  };
};
