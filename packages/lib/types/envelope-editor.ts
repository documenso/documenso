import { EnvelopeType } from '@prisma/client';
import { z } from 'zod';

import { ZEnvelopeFieldSchema } from '@documenso/lib/types/field';
import { ZEnvelopeRecipientLiteSchema } from '@documenso/lib/types/recipient';
import { DocumentMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';
import { EnvelopeItemSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import { EnvelopeSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import { TemplateDirectLinkSchema } from '@documenso/prisma/generated/zod/modelSchema/TemplateDirectLinkSchema';
import { ZBaseEmbedDataSchema } from '@documenso/remix/app/types/embed-base-schemas';

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
    allowDownloadPDF: z.boolean(),
    allowDeletion: z.boolean(),
    allowReturnToPreviousPage: z.boolean(),
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

export const ZEmbedCreateEnvelopeAuthoringSchema = ZBaseEmbedDataSchema.extend({
  externalId: z.string().optional(),
  type: z.nativeEnum(EnvelopeType),
  features: ZEnvelopeEditorSettingsSchema,
});

export const ZEmbedEditEnvelopeAuthoringSchema = ZBaseEmbedDataSchema.extend({
  externalId: z.string().optional(),
  features: ZEnvelopeEditorSettingsSchema,
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
  }),
  recipients: ZEnvelopeRecipientLiteSchema.array(),
  fields: ZEnvelopeFieldSchema.array(),
  envelopeItems: EnvelopeItemSchema.pick({
    envelopeId: true,
    id: true,
    title: true,
    order: true,
  })
    .extend({
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
  }),
  user: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
  }),
});

export type TEditorEnvelope = z.infer<typeof ZEditorEnvelopeSchema>;

export type EnvelopeEditorConfig = TEnvelopeEditorSettings & {
  embeded?: {
    presignToken: string;
    mode: 'create' | 'edit';
    onCreate?: (envelope: Omit<TEditorEnvelope, 'id'>) => void;
    onUpdate?: (envelope: TEditorEnvelope) => void;
    customBrandingLogo?: boolean;
  };
};

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
  },
  actions: {
    allowAttachments: true,
    allowDistributing: true,
    allowDirectLink: true,
    allowDuplication: true,
    allowDownloadPDF: true,
    allowDeletion: true,
    allowReturnToPreviousPage: true,
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
};
