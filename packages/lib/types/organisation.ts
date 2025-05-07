import type { z } from 'zod';

import { OrganisationSchema } from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';

/**
 * The full document response schema.
 *
 * Mainly used for returning a single document from the API.
 */
export const ZOrganisationSchema = OrganisationSchema.pick({
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  url: true,
  avatarImageId: true,
  customerId: true,
  ownerUserId: true,
}).extend({
  // // Todo: Maybe we want to alter this a bit since this returns a lot of data.
  // documentData: OrganisationDataSchema.pick({
  //   type: true,
  //   id: true,
  //   data: true,
  //   initialData: true,
  // }),
  // documentMeta: OrganisationMetaSchema.pick({
  //   signingOrder: true,
  //   distributionMethod: true,
  //   id: true,
  //   subject: true,
  //   message: true,
  //   timezone: true,
  //   password: true,
  //   dateFormat: true,
  //   documentId: true,
  //   redirectUrl: true,
  //   typedSignatureEnabled: true,
  //   uploadSignatureEnabled: true,
  //   drawSignatureEnabled: true,
  //   allowDictateNextSigner: true,
  //   language: true,
  //   emailSettings: true,
  // }).nullable(),
  // recipients: ZRecipientLiteSchema.array(),
  // fields: ZFieldSchema.array(),
});

export type TOrganisation = z.infer<typeof ZOrganisationSchema>;

/**
 * A lite version of the document response schema without relations.
 */
export const ZOrganisationLiteSchema = OrganisationSchema.pick({
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  avatarImageId: true,
  customerId: true,
  ownerUserId: true,
});

/**
 * A version of the document response schema when returning multiple documents at once from a single API endpoint.
 */
export const ZOrganisationManySchema = OrganisationSchema.pick({
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  url: true,
  avatarImageId: true,
  customerId: true,
  ownerUserId: true,
}).extend({
  // user: UserSchema.pick({
  //   id: true,
  //   name: true,
  //   email: true,
  // }),
  // recipients: ZRecipientLiteSchema.array(),
  // team: TeamSchema.pick({
  //   id: true,
  //   url: true,
  // }).nullable(),
});
