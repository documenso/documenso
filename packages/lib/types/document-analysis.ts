import { z } from 'zod';

export const ZDetectedFormFieldSchema = z.object({
  boundingBox: z
    .array(z.number().min(0).max(1000))
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

export type TDetectedFormField = z.infer<typeof ZDetectedFormFieldSchema>;
