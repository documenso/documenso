import { z } from 'zod';

export const ZAddTitleFormSchema = z.object({
  title: z.string().min(1),
});

export type TAddTitleFormSchema = z.infer<typeof ZAddTitleFormSchema>;
