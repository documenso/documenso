import { z } from 'zod';

export const ZAddSubjectFormSchema = z.object({
  email: z.object({
    subject: z.string(),
    message: z.string(),
  }),
});

export type TAddSubjectFormSchema = z.infer<typeof ZAddSubjectFormSchema>;
