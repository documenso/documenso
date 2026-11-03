import { z } from 'zod';

// Stored as a plain string column so new types do not need a DB enum migration.
export const AUTH_HANDOFF_TYPE = {
  EMBED_SESSION: 'EMBED_SESSION',
  EMBED_CSC_SERVICE: 'EMBED_CSC_SERVICE',
  EMBED_CSC_SAD: 'EMBED_CSC_SAD',
  EMBED_CSC_BLOCKING_ERROR: 'EMBED_CSC_BLOCKING_ERROR',
  EMBED_FAILED: 'EMBED_FAILED',
} as const;

// All schemas are strict so an unexpected key in a decrypted row is treated as corruption.
const ZEmbedSessionCreatePayloadSchema = z
  .object({
    userId: z.number().int().positive(),
    sessionId: z.string().min(1),
  })
  .strict();

// `generateSessionToken` output: 20 random bytes, unpadded lower case base32.
const ZSessionTokenSchema = z.string().regex(/^[a-z2-7]{32}$/);

const ZEmbedSessionStoredPayloadSchema = ZEmbedSessionCreatePayloadSchema.extend({
  sessionToken: ZSessionTokenSchema.optional(),
}).strict();

const ZEmbedCscServicePayloadSchema = z
  .object({
    recipientToken: z.string().min(1),
    expiresAt: z.coerce.date(),
  })
  .strict();

const ZEmbedCscSadPayloadSchema = z
  .object({
    sessionId: z.string().min(1),
    expiresAt: z.coerce.date(),
  })
  .strict();

const ZEmbedCscBlockingErrorPayloadSchema = z
  .object({
    code: z.string().min(1),
    recipientToken: z.string().min(1),
  })
  .strict();

const cscHandoffVariants = [
  z.object({
    type: z.literal(AUTH_HANDOFF_TYPE.EMBED_CSC_SERVICE),
    payload: ZEmbedCscServicePayloadSchema,
  }),
  z.object({
    type: z.literal(AUTH_HANDOFF_TYPE.EMBED_CSC_SAD),
    payload: ZEmbedCscSadPayloadSchema,
  }),
  z.object({
    type: z.literal(AUTH_HANDOFF_TYPE.EMBED_CSC_BLOCKING_ERROR),
    payload: ZEmbedCscBlockingErrorPayloadSchema,
  }),
] as const;

const ZEmbedFailedPayloadSchema = z.object({}).strict();

const embedFailedHandoffVariant = z.object({
  type: z.literal(AUTH_HANDOFF_TYPE.EMBED_FAILED),
  payload: ZEmbedFailedPayloadSchema,
});

export const ZAuthHandoffCreateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(AUTH_HANDOFF_TYPE.EMBED_SESSION),
    payload: ZEmbedSessionCreatePayloadSchema,
  }),
  ...cscHandoffVariants,
  embedFailedHandoffVariant,
]);

export type TAuthHandoffCreate = z.infer<typeof ZAuthHandoffCreateSchema>;

export const ZAuthHandoffStoredSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(AUTH_HANDOFF_TYPE.EMBED_SESSION),
    payload: ZEmbedSessionStoredPayloadSchema,
  }),
  ...cscHandoffVariants,
  embedFailedHandoffVariant,
]);

export type TAuthHandoffEmbedCscSadPayload = z.infer<typeof ZEmbedCscSadPayloadSchema>;
export type TAuthHandoffEmbedCscBlockingErrorPayload = z.infer<typeof ZEmbedCscBlockingErrorPayloadSchema>;
