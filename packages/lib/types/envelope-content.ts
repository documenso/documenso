import { EnvelopeContentSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeContentSchema';

/**
 * Internal schema for use within the application.
 *
 * Do not expose to public API.
 */
export const ZEnvelopeContentInternalSchema = EnvelopeContentSchema.pick({
  id: true,
  envelopeId: true,
  envelopeItemId: true,
  metadata: true,
  dataContentId: true,
  zIndex: true,
});

/**
 * Public schema for use in the public API.
 *
 * Keep slim and do not expose unnecessary fields.
 */
export const ZEnvelopeContentApiSchema = EnvelopeContentSchema.pick({
  id: true,
  envelopeId: true,
  envelopeItemId: true,
  metadata: true,
  dataContentId: true,
  zIndex: true,
});
