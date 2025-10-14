import { z } from 'zod';

import { ZAuthenticationResponseJSONSchema } from './webauthn';

/**
 * All the available types of document authentication options for both access and action.
 */
export const ZDocumentAuthTypesSchema = z.enum([
  'ACCOUNT',
  'PASSKEY',
  'TWO_FACTOR_AUTH',
  'PASSWORD',
  'EXPLICIT_NONE',
]);

export const DocumentAuth = ZDocumentAuthTypesSchema.Enum;

const ZDocumentAuthAccountSchema = z.object({
  type: z.literal(DocumentAuth.ACCOUNT),
});

const ZDocumentAuthExplicitNoneSchema = z.object({
  type: z.literal(DocumentAuth.EXPLICIT_NONE),
});

const ZDocumentAuthPasskeySchema = z.object({
  type: z.literal(DocumentAuth.PASSKEY),
  authenticationResponse: ZAuthenticationResponseJSONSchema,
  tokenReference: z.string().min(1),
});

const ZDocumentAuthPasswordSchema = z.object({
  type: z.literal(DocumentAuth.PASSWORD),
  password: z.string().min(1),
});

const ZDocumentAuth2FASchema = z.object({
  type: z.literal(DocumentAuth.TWO_FACTOR_AUTH),
  token: z.string().min(4).max(10),
  method: z.enum(['email', 'authenticator']).default('authenticator').optional(),
});

/**
 * All the document auth methods for both accessing and actioning.
 */
export const ZDocumentAuthMethodsSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuthExplicitNoneSchema,
  ZDocumentAuthPasskeySchema,
  ZDocumentAuth2FASchema,
  ZDocumentAuthPasswordSchema,
]);

/**
 * The global document access auth methods.
 *
 * Must keep these two in sync.
 */
export const ZDocumentAccessAuthSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuth2FASchema,
]);
export const ZDocumentAccessAuthTypesSchema = z
  .enum([DocumentAuth.ACCOUNT, DocumentAuth.TWO_FACTOR_AUTH])
  .describe('The type of authentication required for the recipient to access the document.');

/**
 * The global document action auth methods.
 *
 * Must keep these two in sync.
 */
export const ZDocumentActionAuthSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuthPasskeySchema,
  ZDocumentAuth2FASchema,
  ZDocumentAuthPasswordSchema,
]);
export const ZDocumentActionAuthTypesSchema = z
  .enum([
    DocumentAuth.ACCOUNT,
    DocumentAuth.PASSKEY,
    DocumentAuth.TWO_FACTOR_AUTH,
    DocumentAuth.PASSWORD,
  ])
  .describe(
    'The type of authentication required for the recipient to sign the document. This field is restricted to Enterprise plan users only.',
  );

/**
 * The recipient access auth methods.
 *
 * Must keep these two in sync.
 */
export const ZRecipientAccessAuthSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuth2FASchema,
]);
export const ZRecipientAccessAuthTypesSchema = z
  .enum([DocumentAuth.ACCOUNT, DocumentAuth.TWO_FACTOR_AUTH])
  .describe('The type of authentication required for the recipient to access the document.');

/**
 * The recipient action auth methods.
 *
 * Must keep these two in sync.
 */
export const ZRecipientActionAuthSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuthPasskeySchema,
  ZDocumentAuth2FASchema,
  ZDocumentAuthPasswordSchema,
  ZDocumentAuthExplicitNoneSchema,
]);
export const ZRecipientActionAuthTypesSchema = z
  .enum([
    DocumentAuth.ACCOUNT,
    DocumentAuth.PASSKEY,
    DocumentAuth.TWO_FACTOR_AUTH,
    DocumentAuth.PASSWORD,
    DocumentAuth.EXPLICIT_NONE,
  ])
  .describe('The type of authentication required for the recipient to sign the document.');

export const DocumentAccessAuth = ZDocumentAccessAuthTypesSchema.Enum;
export const DocumentActionAuth = ZDocumentActionAuthTypesSchema.Enum;
export const RecipientAccessAuth = ZRecipientAccessAuthTypesSchema.Enum;
export const RecipientActionAuth = ZRecipientActionAuthTypesSchema.Enum;

/**
 * Authentication options attached to the document.
 */
export const ZDocumentAuthOptionsSchema = z.preprocess(
  (unknownValue) => {
    if (!unknownValue || typeof unknownValue !== 'object') {
      return {
        globalAccessAuth: [],
        globalActionAuth: [],
      };
    }

    const globalAccessAuth =
      'globalAccessAuth' in unknownValue ? processAuthValue(unknownValue.globalAccessAuth) : [];
    const globalActionAuth =
      'globalActionAuth' in unknownValue ? processAuthValue(unknownValue.globalActionAuth) : [];

    return {
      globalAccessAuth,
      globalActionAuth,
    };
  },
  z.object({
    globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema),
    globalActionAuth: z.array(ZDocumentActionAuthTypesSchema),
  }),
);

/**
 * Authentication options attached to the recipient.
 */
export const ZRecipientAuthOptionsSchema = z.preprocess(
  (unknownValue) => {
    if (!unknownValue || typeof unknownValue !== 'object') {
      return {
        accessAuth: [],
        actionAuth: [],
      };
    }

    const accessAuth =
      'accessAuth' in unknownValue ? processAuthValue(unknownValue.accessAuth) : [];
    const actionAuth =
      'actionAuth' in unknownValue ? processAuthValue(unknownValue.actionAuth) : [];

    return {
      accessAuth,
      actionAuth,
    };
  },
  z.object({
    accessAuth: z.array(ZRecipientAccessAuthTypesSchema),
    actionAuth: z.array(ZRecipientActionAuthTypesSchema),
  }),
);

/**
 * Utility function to process the auth value.
 *
 * Converts the old singular auth value to an array of auth values.
 */
const processAuthValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
};

export type TDocumentAuth = z.infer<typeof ZDocumentAuthTypesSchema>;
export type TDocumentAuthMethods = z.infer<typeof ZDocumentAuthMethodsSchema>;
export type TDocumentAuthOptions = z.infer<typeof ZDocumentAuthOptionsSchema>;
export type TDocumentAccessAuth = z.infer<typeof ZDocumentAccessAuthSchema>;
export type TDocumentAccessAuthTypes = z.infer<typeof ZDocumentAccessAuthTypesSchema>;
export type TDocumentActionAuth = z.infer<typeof ZDocumentActionAuthSchema>;
export type TDocumentActionAuthTypes = z.infer<typeof ZDocumentActionAuthTypesSchema>;
export type TRecipientAccessAuth = z.infer<typeof ZRecipientAccessAuthSchema>;
export type TRecipientAccessAuthTypes = z.infer<typeof ZRecipientAccessAuthTypesSchema>;
export type TRecipientActionAuth = z.infer<typeof ZRecipientActionAuthSchema>;
export type TRecipientActionAuthTypes = z.infer<typeof ZRecipientActionAuthTypesSchema>;
export type TRecipientAuthOptions = z.infer<typeof ZRecipientAuthOptionsSchema>;
