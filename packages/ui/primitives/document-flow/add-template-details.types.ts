import { z } from 'zod';

export const ZAddTemplateSchema = z.object({
  template: z.object({
    name: z.string(),
    description: z.string(),
  }),
});

export type TAddTemplateSchema = z.infer<typeof ZAddTemplateSchema>;
