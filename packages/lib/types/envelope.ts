import { z } from 'zod';

import { DocumentMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';
import { EnvelopeItemSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import { EnvelopeSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import TemplateDirectLinkSchema from '@documenso/prisma/generated/zod/modelSchema/TemplateDirectLinkSchema';

import { ZEnvelopeFieldSchema } from './field';
import { ZEnvelopeRecipientLiteSchema } from './recipient';

/**
 * The full envelope response schema.
 *
 * Mainly used for returning a single envelope from the API.
 */
export const ZEnvelopeSchema = EnvelopeSchema.pick({
  internalVersion: true,
  type: true,
  status: true,
  source: true,
  visibility: true,
  templateType: true,
  id: true,
  secondaryId: true,
  externalId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  title: true,
  authOptions: true,
  formValues: true,
  publicTitle: true,
  publicDescription: true,
  userId: true,
  teamId: true,
  folderId: true,
  templateId: true,
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
  }).array(),
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

export type TEnvelope = z.infer<typeof ZEnvelopeSchema>;

/**
 * A lite version of the envelope response schema without relations.
 */
export const ZEnvelopeLiteSchema = EnvelopeSchema.pick({
  internalVersion: true,
  type: true,
  status: true,
  source: true,
  visibility: true,
  templateType: true,
  id: true,
  secondaryId: true,
  externalId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  title: true,
  authOptions: true,
  formValues: true,
  publicTitle: true,
  publicDescription: true,
  userId: true,
  teamId: true,
  folderId: true,
});

export type TEnvelopeLite = z.infer<typeof ZEnvelopeLiteSchema>;

/**
 * A version of the envelope response schema when returning multiple envelopes at once from a single API endpoint.
 */
// export const ZEnvelopeManySchema = X
// export type TEnvelopeMany = z.infer<typeof ZEnvelopeManySchema>;
