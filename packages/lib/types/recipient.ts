import { z } from 'zod';

import { RecipientSchema } from '@documenso/prisma/generated/zod/modelSchema/RecipientSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import { UserSchema } from '@documenso/prisma/generated/zod/modelSchema/UserSchema';

import { ZFieldSchema } from './field';

/**
 * The full recipient response schema.
 *
 * Mainly used for returning a single recipient from the API.
 */
export const ZRecipientSchema = RecipientSchema.pick({
  envelopeId: true,
  role: true,
  readStatus: true,
  signingStatus: true,
  sendStatus: true,
  id: true,
  email: true,
  name: true,
  token: true,
  documentDeletedAt: true,
  expired: true,
  signedAt: true,
  authOptions: true,
  signingOrder: true,
  rejectionReason: true,
}).extend({
  fields: ZFieldSchema.array(),

  // Backwards compatibility.
  documentId: z.number().nullish(),
  templateId: z.number().nullish(),
});

/**
 * A lite version of the recipient response schema without relations.
 */
export const ZRecipientLiteSchema = RecipientSchema.pick({
  envelopeId: true,
  role: true,
  readStatus: true,
  signingStatus: true,
  sendStatus: true,
  id: true,
  email: true,
  name: true,
  token: true,
  documentDeletedAt: true,
  expired: true,
  signedAt: true,
  authOptions: true,
  signingOrder: true,
  rejectionReason: true,
}).extend({
  // Backwards compatibility.
  documentId: z.number().nullish(),
  templateId: z.number().nullish(),
});

/**
 * A version of the recipient response schema when returning multiple recipients at once from a single API endpoint.
 */
export const ZRecipientManySchema = RecipientSchema.pick({
  envelopeId: true,
  role: true,
  readStatus: true,
  signingStatus: true,
  sendStatus: true,
  id: true,
  email: true,
  name: true,
  token: true,
  documentDeletedAt: true,
  expired: true,
  signedAt: true,
  authOptions: true,
  signingOrder: true,
  rejectionReason: true,
}).extend({
  user: UserSchema.pick({
    id: true,
    name: true,
    email: true,
  }),
  recipients: RecipientSchema.array(),
  team: TeamSchema.pick({
    id: true,
    url: true,
  }).nullable(),

  // Backwards compatibility.
  documentId: z.number().nullish(),
  templateId: z.number().nullish(),
});

export const ZEnvelopeRecipientSchema = ZRecipientSchema.omit({
  documentId: true,
  templateId: true,
});

export const ZEnvelopeRecipientLiteSchema = ZRecipientLiteSchema.omit({
  documentId: true,
  templateId: true,
});

export const ZEnvelopeRecipientManySchema = ZRecipientManySchema.omit({
  documentId: true,
  templateId: true,
});
