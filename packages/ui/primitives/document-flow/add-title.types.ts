import { z } from 'zod';

export const ZAddTitleFormSchema = z.object({
  title: z.string().trim().min(1, { message: "Title can't be empty" }),
});

export type TAddTitleFormSchema = z.infer<typeof ZAddTitleFormSchema>;
