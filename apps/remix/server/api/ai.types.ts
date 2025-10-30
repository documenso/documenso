import { z } from 'zod';

export const ZGenerateTextRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt is too long'),
});

export const ZGenerateTextResponseSchema = z.object({
  text: z.string(),
});

export type TGenerateTextRequest = z.infer<typeof ZGenerateTextRequestSchema>;
export type TGenerateTextResponse = z.infer<typeof ZGenerateTextResponseSchema>;

export const ZDetectedFormFieldSchema = z.object({
  box_2d: z
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
});

export const ZDetectFormFieldsRequestSchema = z.object({
  image: z.instanceof(Blob, { message: 'Image file is required' }),
});

export const ZDetectFormFieldsResponseSchema = z.array(ZDetectedFormFieldSchema);

export type TDetectedFormField = z.infer<typeof ZDetectedFormFieldSchema>;
export type TDetectFormFieldsRequest = z.infer<typeof ZDetectFormFieldsRequestSchema>;
export type TDetectFormFieldsResponse = z.infer<typeof ZDetectFormFieldsResponseSchema>;
