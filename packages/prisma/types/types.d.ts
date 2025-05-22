/* eslint-disable @typescript-eslint/no-namespace */
import type {
  TDocumentAuthOptions,
  TRecipientAuthOptions,
} from '@documenso/lib/types/document-auth';
import type { TDocumentEmailSettings } from '@documenso/lib/types/document-email';
import type { TDocumentFormValues } from '@documenso/lib/types/document-form-values';
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

    type RecipientAuthOptions = TRecipientAuthOptions;

    type FieldMeta = TFieldMetaNotOptionalSchema;
  }
}

export {};
