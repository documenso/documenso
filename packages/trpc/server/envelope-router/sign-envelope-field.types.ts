import { z } from 'zod';

import { ZRecipientActionAuthSchema } from '@documenso/lib/types/document-auth';
import { ZFieldSchema } from '@documenso/lib/types/field';
import { FieldType } from '@documenso/prisma/client';
import SignatureSchema from '@documenso/prisma/generated/zod/modelSchema/SignatureSchema';

export const ZSignEnvelopeFieldValue = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(FieldType.CHECKBOX),
    value: z.array(z.number()),
  }),
  z.object({
    type: z.literal(FieldType.RADIO),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.NUMBER),
    value: z.number().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.EMAIL),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.NAME),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.INITIALS),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.TEXT),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.DROPDOWN),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.DATE),
    value: z.boolean(),
  }),
  z.object({
    type: z.literal(FieldType.SIGNATURE),
    value: z.string().nullable(),
    isBase64: z.boolean(),
  }),
]);

export const ZSignEnvelopeFieldRequestSchema = z.object({
  token: z.string(),
  fieldId: z.number(),
  fieldValue: ZSignEnvelopeFieldValue,
  authOptions: ZRecipientActionAuthSchema.optional(),
});

export const ZSignEnvelopeFieldResponseSchema = z.object({
  signedField: ZFieldSchema.extend({
    signature: SignatureSchema.nullish(),
  }),
});

export type TSignEnvelopeFieldValue = z.infer<typeof ZSignEnvelopeFieldValue>;
export type TSignEnvelopeFieldRequest = z.infer<typeof ZSignEnvelopeFieldRequestSchema>;
export type TSignEnvelopeFieldResponse = z.infer<typeof ZSignEnvelopeFieldResponseSchema>;
