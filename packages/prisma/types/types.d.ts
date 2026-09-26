/* eslint-disable @typescript-eslint/no-namespace */

import type { TDataContentMeta } from '@documenso/lib/types/data-content-meta';
import type { TDefaultRecipient } from '@documenso/lib/types/default-recipients';
import type { TDocumentAuthOptions, TRecipientAuthOptions } from '@documenso/lib/types/document-auth';
import type { TDocumentEmailSettings } from '@documenso/lib/types/document-email';
import type { TDocumentFormValues } from '@documenso/lib/types/document-form-values';
import type { TEnvelopeAttachmentType } from '@documenso/lib/types/envelope-attachment';
import type { TEnvelopeContentMeta } from '@documenso/lib/types/envelope-content-meta';
import type { TFieldMetaNotOptionalSchema } from '@documenso/lib/types/field-meta';
import type { TClaimFlags } from '@documenso/lib/types/subscription';

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
    type EnvelopeContentMeta = TEnvelopeContentMeta;
    type DataContentMeta = TDataContentMeta;

    type EnvelopeAttachmentType = TEnvelopeAttachmentType;

    type DefaultRecipient = TDefaultRecipient;
  }
}
