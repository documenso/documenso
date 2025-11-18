import { z } from 'zod';

import type { TDetectedFormField } from '@documenso/lib/types/document-analysis';

export const ZGenerateTextRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt is too long'),
});

export const ZGenerateTextResponseSchema = z.object({
  text: z.string(),
});

export type TGenerateTextRequest = z.infer<typeof ZGenerateTextRequestSchema>;
export type TGenerateTextResponse = z.infer<typeof ZGenerateTextResponseSchema>;

export const ZDetectedFormFieldSchema = z.object({
  boundingBox: z
    .array(z.number())
    .length(4)
    .describe('Bounding box [ymin, xmin, ymax, xmax] in normalized 0-1000 range'),
  label: z
    .enum([
      'SIGNATURE',
      'INITIALS',
      'NAME',
      'EMAIL',
      'DATE',
      'TEXT',
      'NUMBER',
      'RADIO',
      'CHECKBOX',
      'DROPDOWN',
    ])
    .describe('Documenso field type inferred from nearby label text or visual characteristics'),
  pageNumber: z
    .number()
    .int()
    .positive()
    .describe('1-indexed page number where field was detected'),
  recipientId: z
    .number()
    .int()
    .describe(
      'ID of the recipient (from the provided envelope recipients) who should own the field',
    ),
});

export const ZDetectFormFieldsRequestSchema = z.object({
  envelopeId: z.string().min(1, { message: 'Envelope ID is required' }),
});

export const ZDetectFormFieldsResponseSchema = z.array(ZDetectedFormFieldSchema);

export type TDetectFormFieldsRequest = z.infer<typeof ZDetectFormFieldsRequestSchema>;
export type TDetectFormFieldsResponse = z.infer<typeof ZDetectFormFieldsResponseSchema>;
export type { TDetectedFormField };

const recipientFieldShape = {
  name: z.string().describe('Full name of the recipient'),
  role: z.enum(['SIGNER', 'APPROVER', 'CC']).describe('Recipient role based on document context'),
  signingOrder: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Sequential signing order if document indicates ordering'),
} as const;

const createRecipientSchema = <TSchema extends z.ZodTypeAny>(emailSchema: TSchema) =>
  z.object({
    ...recipientFieldShape,
    email: emailSchema,
  });

export const ZDetectedRecipientLLMSchema = createRecipientSchema(
  z
    .string()
    .trim()
    .max(320)
    .optional()
    .describe(
      'Email address from the document. If missing or invalid, a placeholder will be generated.',
    ),
);

export const ZDetectedRecipientSchema = createRecipientSchema(
  z.string().email().optional().describe('Email address for the recipient (if found in document).'),
);

export const ZAnalyzeRecipientsRequestSchema = z.object({
  envelopeId: z.string().min(1, { message: 'Envelope ID is required' }),
});

export const ZAnalyzeRecipientsResponseSchema = z.array(ZDetectedRecipientSchema);

export type TDetectedRecipient = z.infer<typeof ZDetectedRecipientSchema>;
export type TAnalyzeRecipientsRequest = z.infer<typeof ZAnalyzeRecipientsRequestSchema>;
export type TAnalyzeRecipientsResponse = z.infer<typeof ZAnalyzeRecipientsResponseSchema>;
