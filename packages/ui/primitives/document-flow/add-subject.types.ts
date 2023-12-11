import { z } from 'zod';

export const ZAddSubjectFormSchema = z.object({
  email: z.object({
    subject: z.string(),
    message: z.string(),
    timezone: z.string().optional().default('Europe/London'),
    dateFormat: z.string().optional().default('yyyy-MM-dd hh:mm a'),
  }),
});

export type TAddSubjectFormSchema = z.infer<typeof ZAddSubjectFormSchema>;
