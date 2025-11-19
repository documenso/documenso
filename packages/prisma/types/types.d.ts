/* eslint-disable @typescript-eslint/no-namespace */
import type {
  TDocumentAuthOptions,
  TRecipientAuthOptions,
} from '@doku-seal/lib/types/document-auth';
import type { TDocumentEmailSettings } from '@doku-seal/lib/types/document-email';
import type { TDocumentFormValues } from '@doku-seal/lib/types/document-form-values';
import type { TEnvelopeAttachmentType } from '@doku-seal/lib/types/envelope-attachment';
import type { TFieldMetaNotOptionalSchema } from '@doku-seal/lib/types/field-meta';
import type { TClaimFlags } from '@doku-seal/lib/types/subscription';

/**
 * Global types for Prisma.Json instances.
 */
declare global {
  namespace PrismaJson {
    type ClaimFlags = TClaimFlags;

    type DocumentFormValues = TDocumentFormValues;
    type DocumentAuthOptions = TDocumentAuthOptions;
    type DocumentEmailSettings = TDocumentEmailSettings;
    type DocumentEmailSettingsNullable = TDocumentEmailSettings | null;

    type RecipientAuthOptions = TRecipientAuthOptions;

    type FieldMeta = TFieldMetaNotOptionalSchema;

    type EnvelopeAttachmentType = TEnvelopeAttachmentType;
  }
}

export {};
