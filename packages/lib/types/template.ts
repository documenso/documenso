import type { z } from 'zod';

import { DocumentDataSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import { TemplateDirectLinkSchema } from '@documenso/prisma/generated/zod/modelSchema/TemplateDirectLinkSchema';
import { TemplateMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/TemplateMetaSchema';
import { TemplateSchema } from '@documenso/prisma/generated/zod/modelSchema/TemplateSchema';
import { UserSchema } from '@documenso/prisma/generated/zod/modelSchema/UserSchema';

import { ZFieldSchema } from './field';
import { ZRecipientLiteSchema } from './recipient';

/**
 * The full template response schema.
 *
 * Mainly used for returning a single template from the API.
 */
export const ZTemplateSchema = TemplateSchema.pick({
  type: true,
  visibility: true,
  id: true,
  externalId: true,
  title: true,
  userId: true,
  teamId: true,
  authOptions: true,
  templateDocumentDataId: true,
  createdAt: true,
  updatedAt: true,
  publicTitle: true,
  publicDescription: true,
}).extend({
  // Todo: Maybe we want to alter this a bit since this returns a lot of data.
  templateDocumentData: DocumentDataSchema.pick({
    type: true,
    id: true,
    data: true,
    initialData: true,
  }),
  templateMeta: TemplateMetaSchema.pick({
    id: true,
    subject: true,
    message: true,
    timezone: true,
    dateFormat: true,
    signingOrder: true,
    typedSignatureEnabled: true,
    uploadSignatureEnabled: true,
    drawSignatureEnabled: true,
    allowDictateNextSigner: true,
    distributionMethod: true,
    templateId: true,
    redirectUrl: true,
    language: true,
    emailSettings: true,
  }).nullable(),
  directLink: TemplateDirectLinkSchema.nullable(),
  user: UserSchema.pick({
    id: true,
    name: true,
    email: true,
  }),
  recipients: ZRecipientLiteSchema.array(),
  fields: ZFieldSchema.array(),
});

export type TTemplate = z.infer<typeof ZTemplateSchema>;

/**
 * A lite version of the template response schema without relations.
 */
export const ZTemplateLiteSchema = TemplateSchema.pick({
  type: true,
  visibility: true,
  id: true,
  externalId: true,
  title: true,
  userId: true,
  teamId: true,
  authOptions: true,
  templateDocumentDataId: true,
  createdAt: true,
  updatedAt: true,
  publicTitle: true,
  publicDescription: true,
});

/**
 * A version of the template response schema when returning multiple template at once from a single API endpoint.
 */
export const ZTemplateManySchema = TemplateSchema.pick({
  type: true,
  visibility: true,
  id: true,
  externalId: true,
  title: true,
  userId: true,
  teamId: true,
  authOptions: true,
  templateDocumentDataId: true,
  createdAt: true,
  updatedAt: true,
  publicTitle: true,
  publicDescription: true,
}).extend({
  team: TeamSchema.pick({
    id: true,
    url: true,
  }).nullable(),
  fields: ZFieldSchema.array(),
  recipients: ZRecipientLiteSchema.array(),
  templateMeta: TemplateMetaSchema.pick({
    signingOrder: true,
    distributionMethod: true,
  }).nullable(),
  directLink: TemplateDirectLinkSchema.pick({
    token: true,
    enabled: true,
  }).nullable(),
});
