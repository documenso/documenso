import { DocumentVisibility } from '@prisma/client';
import { z } from 'zod';

import {
  ZDocumentExpiryAmountSchema,
  ZDocumentExpiryUnitSchema,
} from '@documenso/lib/types/document-meta';

/**
 * Required for empty responses since we currently can't 201 requests for our openapi setup.
 *
 * Without this it will throw an error in Speakeasy SDK when it tries to parse an empty response.
 */
export const ZSuccessResponseSchema = z.object({
  success: z.literal(true),
});

export const ZGenericSuccessResponse = {
  success: true,
} satisfies z.infer<typeof ZSuccessResponseSchema>;

export const ZDocumentTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .describe('The title of the document.');

export const ZDocumentExternalIdSchema = z
  .string()
  .trim()
  .max(255)
  .describe('The external ID of the document.');

export const ZDocumentVisibilitySchema = z
  .nativeEnum(DocumentVisibility)
  .describe('The visibility of the document.');

// Re-export expiry schemas for convenience
export { ZDocumentExpiryAmountSchema, ZDocumentExpiryUnitSchema };
