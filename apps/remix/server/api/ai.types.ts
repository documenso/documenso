import { z } from 'zod';

export const ZGenerateTextRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt is too long'),
});

export const ZGenerateTextResponseSchema = z.object({
  text: z.string(),
});

export type TGenerateTextRequest = z.infer<typeof ZGenerateTextRequestSchema>;
export type TGenerateTextResponse = z.infer<typeof ZGenerateTextResponseSchema>;

export const ZDetectedObjectSchema = z.object({
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

export const ZDetectObjectsRequestSchema = z.object({
  imagePath: z.string().min(1, 'Image path is required'),
  // TODO: Replace with file upload - reference files.ts pattern
});

export const ZDetectObjectsResponseSchema = z.array(ZDetectedObjectSchema);

export type TDetectedObject = z.infer<typeof ZDetectedObjectSchema>;
export type TDetectObjectsRequest = z.infer<typeof ZDetectObjectsRequestSchema>;
export type TDetectObjectsResponse = z.infer<typeof ZDetectObjectsResponseSchema>;

export const ZDetectObjectsAndDrawRequestSchema = z.object({
  imagePath: z.string().min(1, 'Image path is required'),
});

export const ZDetectObjectsAndDrawResponseSchema = z.object({
  outputPath: z.string().describe('Path to the generated image with bounding boxes'),
  detectedObjects: z.array(ZDetectedObjectSchema).describe('Array of detected objects'),
});

export type TDetectObjectsAndDrawRequest = z.infer<typeof ZDetectObjectsAndDrawRequestSchema>;
export type TDetectObjectsAndDrawResponse = z.infer<typeof ZDetectObjectsAndDrawResponseSchema>;
