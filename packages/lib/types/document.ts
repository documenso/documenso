import type { z } from 'zod';

import { DocumentDataSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import { DocumentMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';
import { DocumentSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import { UserSchema } from '@documenso/prisma/generated/zod/modelSchema/UserSchema';

import { ZFieldSchema } from './field';
import { ZRecipientLiteSchema } from './recipient';

/**
 * The full document response schema.
 *
 * Mainly used for returning a single document from the API.
 */
export const ZDocumentSchema = DocumentSchema.pick({
  visibility: true,
  status: true,
  source: true,
  id: true,
  externalId: true,
  userId: true,
  authOptions: true,
  formValues: true,
  title: true,
  documentDataId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  teamId: true,
  templateId: true,
}).extend({
  // Todo: Maybe we want to alter this a bit since this returns a lot of data.
  documentData: DocumentDataSchema.pick({
    type: true,
    id: true,
    data: true,
    initialData: true,
  }),
  documentMeta: DocumentMetaSchema.pick({
    signingOrder: true,
    distributionMethod: true,
    id: true,
    subject: true,
    message: true,
    timezone: true,
    password: true,
    dateFormat: true,
    documentId: true,
    redirectUrl: true,
    typedSignatureEnabled: true,
    uploadSignatureEnabled: true,
    drawSignatureEnabled: true,
    allowDictateNextSigner: true,
    language: true,
    emailSettings: true,
  }).nullable(),
  recipients: ZRecipientLiteSchema.array(),
  fields: ZFieldSchema.array(),
});

export type TDocument = z.infer<typeof ZDocumentSchema>;

/**
 * A lite version of the document response schema without relations.
 */
export const ZDocumentLiteSchema = DocumentSchema.pick({
  visibility: true,
  status: true,
  source: true,
  id: true,
  externalId: true,
  userId: true,
  authOptions: true,
  formValues: true,
  title: true,
  documentDataId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  teamId: true,
  templateId: true,
});

/**
 * A version of the document response schema when returning multiple documents at once from a single API endpoint.
 */
export const ZDocumentManySchema = DocumentSchema.pick({
  visibility: true,
  status: true,
  source: true,
  id: true,
  externalId: true,
  userId: true,
  authOptions: true,
  formValues: true,
  title: true,
  documentDataId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  teamId: true,
  templateId: true,
}).extend({
  user: UserSchema.pick({
    id: true,
    name: true,
    email: true,
  }),
  recipients: ZRecipientLiteSchema.array(),
  team: TeamSchema.pick({
    id: true,
    url: true,
  }).nullable(),
});
