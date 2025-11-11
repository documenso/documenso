import { z } from 'zod';

import { DocumentDataSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import { DocumentMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';
import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import { FolderSchema } from '@documenso/prisma/generated/zod/modelSchema/FolderSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import { UserSchema } from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import {
  LegacyTemplateDirectLinkSchema,
  TemplateSchema,
} from '@documenso/prisma/types/template-legacy-schema';

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
  createdAt: true,
  updatedAt: true,
  publicTitle: true,
  publicDescription: true,
  folderId: true,
}).extend({
  envelopeId: z.string(),

  // Backwards compatibility.
  templateDocumentDataId: z.string().default(''),

  // Todo: Maybe we want to alter this a bit since this returns a lot of data.
  templateDocumentData: DocumentDataSchema.pick({
    type: true,
    id: true,
    data: true,
    initialData: true,
  }).extend({
    envelopeItemId: z.string(),
  }),
  templateMeta: DocumentMetaSchema.pick({
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
    redirectUrl: true,
    language: true,
    emailSettings: true,
    emailId: true,
    emailReplyTo: true,
  }).extend({
    templateId: z.number().nullable(),
  }),
  directLink: LegacyTemplateDirectLinkSchema.nullable(),
  user: UserSchema.pick({
    id: true,
    name: true,
    email: true,
  }),
  recipients: ZRecipientLiteSchema.array(),
  fields: ZFieldSchema.array(),
  folder: FolderSchema.pick({
    id: true,
    name: true,
    type: true,
    visibility: true,
    userId: true,
    teamId: true,
    pinned: true,
    parentId: true,
    createdAt: true,
    updatedAt: true,
  }).nullable(),
  envelopeItems: EnvelopeItemSchema.pick({
    id: true,
    envelopeId: true,
  }).array(),
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
  createdAt: true,
  updatedAt: true,
  publicTitle: true,
  publicDescription: true,
  folderId: true,
  useLegacyFieldInsertion: true,
}).extend({
  envelopeId: z.string(),

  // Backwards compatibility.
  templateDocumentDataId: z.string().default(''),
});

export type TTemplateLite = z.infer<typeof ZTemplateLiteSchema>;

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
  createdAt: true,
  updatedAt: true,
  publicTitle: true,
  publicDescription: true,
  folderId: true,
  useLegacyFieldInsertion: true,
}).extend({
  envelopeId: z.string(),
  team: TeamSchema.pick({
    id: true,
    url: true,
  }).nullable(),
  fields: ZFieldSchema.array(),
  recipients: ZRecipientLiteSchema.array(),
  templateMeta: DocumentMetaSchema.pick({
    signingOrder: true,
    distributionMethod: true,
  }).nullable(),
  directLink: LegacyTemplateDirectLinkSchema.pick({
    token: true,
    enabled: true,
  }).nullable(),
  // Backwards compatibility.
  templateDocumentDataId: z.string().default(''),
});

export type TTemplateMany = z.infer<typeof ZTemplateManySchema>;
