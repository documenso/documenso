import { z } from 'zod';

export const ZAddTitleFormSchema = z.object({
  title: z
    .string()
    .min(1, { message: "Title can't be empty" })
    .trim()
    .refine((value) => value.length > 0, {
      message: "Title can't be empty",
    }),
});

export type TAddTitleFormSchema = z.infer<typeof ZAddTitleFormSchema>;
