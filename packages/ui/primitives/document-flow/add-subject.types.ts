import { z } from 'zod';

export const ZAddSubjectFormSchema = z.object({
<<<<<<< HEAD
  email: z.object({
=======
  meta: z.object({
>>>>>>> main
    subject: z.string(),
    message: z.string(),
  }),
});

export type TAddSubjectFormSchema = z.infer<typeof ZAddSubjectFormSchema>;
