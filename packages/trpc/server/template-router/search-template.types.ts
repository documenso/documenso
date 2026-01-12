import { z } from 'zod';

export const ZSearchTemplateRequestSchema = z.object({
  query: z.string().trim().min(1),
});

export const ZSearchTemplateResponseSchema = z
  .object({
    title: z.string(),
    path: z.string(),
    value: z.string(),
  })
  .array();

export type TSearchTemplateRequest = z.infer<typeof ZSearchTemplateRequestSchema>;
export type TSearchTemplateResponse = z.infer<typeof ZSearchTemplateResponseSchema>;
