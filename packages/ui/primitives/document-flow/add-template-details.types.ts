import { z } from 'zod';

export const ZAddTemplateDetailsFormSchema = z.object({
  template: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export type TAddTemplateDetailsFormSchema = z.infer<typeof ZAddTemplateDetailsFormSchema>;
