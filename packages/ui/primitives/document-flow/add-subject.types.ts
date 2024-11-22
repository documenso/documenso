import { z } from 'zod';

import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';

import { DocumentDistributionMethod } from '.prisma/client';

export const ZAddSubjectFormSchema = z.object({
  meta: z.object({
    subject: z.string(),
    message: z.string(),
    distributionMethod: z
      .nativeEnum(DocumentDistributionMethod)
      .optional()
      .default(DocumentDistributionMethod.EMAIL),
    emailSettings: ZDocumentEmailSettingsSchema,
  }),
});

export type TAddSubjectFormSchema = z.infer<typeof ZAddSubjectFormSchema>;
