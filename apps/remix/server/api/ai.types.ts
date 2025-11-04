import { z } from 'zod';

import type { TDetectedFormField } from '@documenso/lib/types/ai';

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
});

export const ZDetectFormFieldsRequestSchema = z.object({
  documentId: z.string().min(1, { message: 'Document ID is required' }),
});

export const ZDetectFormFieldsResponseSchema = z.array(ZDetectedFormFieldSchema);

export type TDetectFormFieldsRequest = z.infer<typeof ZDetectFormFieldsRequestSchema>;
export type TDetectFormFieldsResponse = z.infer<typeof ZDetectFormFieldsResponseSchema>;
export type { TDetectedFormField };
