import { ZRecipientActionAuthSchema } from '@documenso/lib/types/document-auth';
import { ZFieldSchema } from '@documenso/lib/types/field';
import { FieldType } from '@documenso/prisma/client';
import SignatureSchema from '@documenso/prisma/generated/zod/modelSchema/SignatureSchema';
import { z } from 'zod';

export const ZSignEnvelopeFieldValue = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(FieldType.CHECKBOX),
    value: z.array(z.number()).describe('The indices of the selected options'),
  }),
  z.object({
    type: z.literal(FieldType.RADIO),
    value: z.number().nullable().describe('The index of the selected option'),
  }),
  z.object({
    type: z.literal(FieldType.NUMBER),
    value: z.string().nullable(),
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
  }),
]);

export const ZSignEnvelopeFieldValuesSchema = z
  .array(
    z.object({
      fieldId: z.number(),
      fieldValue: ZSignEnvelopeFieldValue,
    }),
  )
  .min(1)
  .describe(
    'The fields to sign. Multiple fields may only be provided when they all belong to the same checkbox group, in which case the selection is validated across the whole group.',
  );

export const ZSignEnvelopeFieldRequestSchema = z.object({
  token: z.string(),
  fieldValues: ZSignEnvelopeFieldValuesSchema,
  authOptions: ZRecipientActionAuthSchema.optional(),
});

const ZSignedFieldSchema = ZFieldSchema.omit({
  templateId: true,
  documentId: true,
}).extend({
  signature: SignatureSchema.nullish(),
});

export const ZSignEnvelopeFieldResponseSchema = z.object({
  signedFields: ZSignedFieldSchema.array().describe(
    'Every field affected by the request. Contains the signed field plus any fields in the same group which were inserted or uninserted alongside it.',
  ),
});

export type TSignEnvelopeFieldValue = z.infer<typeof ZSignEnvelopeFieldValue>;
export type TSignEnvelopeFieldValues = z.infer<typeof ZSignEnvelopeFieldValuesSchema>;
export type TSignEnvelopeFieldRequest = z.infer<typeof ZSignEnvelopeFieldRequestSchema>;
export type TSignEnvelopeFieldResponse = z.infer<typeof ZSignEnvelopeFieldResponseSchema>;
