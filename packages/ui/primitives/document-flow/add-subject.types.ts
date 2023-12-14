import { z } from 'zod';

export const ZAddSubjectFormSchema = z.object({
  meta: z.object({
    subject: z.string(),
    message: z.string(),
    timezone: z.string().optional().default('Etc/UTC'),
    dateFormat: z.string().optional().default('yyyy-MM-dd hh:mm a'),
  }),
});

export type TAddSubjectFormSchema = z.infer<typeof ZAddSubjectFormSchema>;
