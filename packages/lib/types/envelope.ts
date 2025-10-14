import { z } from 'zod';

import DocumentDataSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import { DocumentMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';
import { EnvelopeItemSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import { EnvelopeSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import TemplateDirectLinkSchema from '@documenso/prisma/generated/zod/modelSchema/TemplateDirectLinkSchema';

import { ZFieldSchema } from './field';
import { ZRecipientLiteSchema } from './recipient';

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
}).extend({
  templateId: z
    .number()
    .nullish()
    .describe('The ID of the template that the document was created from, if any.'),
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
  recipients: ZRecipientLiteSchema.omit({
    documentId: true,
    templateId: true,
  }).array(),
  fields: ZFieldSchema.omit({
    documentId: true,
    templateId: true,
  }).array(),
  envelopeItems: EnvelopeItemSchema.pick({
    id: true,
    title: true,
    documentDataId: true,
    order: true,
  })
    .extend({
      documentData: DocumentDataSchema.pick({
        type: true,
        id: true,
        data: true,
        initialData: true, // Todo: Envelopes - Maybe this hide this.
      }),
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
