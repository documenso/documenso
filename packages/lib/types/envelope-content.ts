import { EnvelopeContentSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeContentSchema';

/**
 * Note: Any changes here will cause backwards incompatible changes to the API.
 */
export const ZEnvelopeContentSchema = EnvelopeContentSchema.pick({
  id: true,
  envelopeId: true,
  envelopeItemId: true,
  contentMeta: true,
  dataContentId: true,
});
