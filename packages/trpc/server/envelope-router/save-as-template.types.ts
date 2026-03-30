import { z } from 'zod';

export const ZSaveAsTemplateRequestSchema = z.object({
  envelopeId: z.string().min(1).describe('The ID of the envelope to save as a template.'),
  includeRecipients: z.boolean(),
  includeFields: z.boolean(),
});

export const ZSaveAsTemplateResponseSchema = z.object({
  id: z.string().describe('The ID of the newly created template envelope.'),
});

export type TSaveAsTemplateRequest = z.infer<typeof ZSaveAsTemplateRequestSchema>;
export type TSaveAsTemplateResponse = z.infer<typeof ZSaveAsTemplateResponseSchema>;
