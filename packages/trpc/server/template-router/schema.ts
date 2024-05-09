import { z } from 'zod';

import { URL_REGEX } from '@documenso/lib/constants/url-regex';
import { RecipientRole } from '@documenso/prisma/client';

export const ZCreateTemplateMutationSchema = z.object({
  title: z.string().min(1).trim(),
  teamId: z.number().optional(),
  templateDocumentDataId: z.string().min(1),
});

export const ZCreateDocumentFromTemplateMutationSchema = z.object({
  templateId: z.number(),
  teamId: z.number().optional(),
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string(),
        role: z.nativeEnum(RecipientRole),
      }),
    )
    .optional(),
});

export const ZSetSettingsForTemplateMutationSchema = z.object({
  templateId: z.number(),
  meta: z.object({
    subject: z.string().optional(),
    message: z.string().optional(),
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    redirectUrl: z
      .string()
      .optional()
      .refine((value) => value === undefined || value === '' || URL_REGEX.test(value), {
        message: 'Please enter a valid URL',
      }),
  }),
});

export const ZDuplicateTemplateMutationSchema = z.object({
  templateId: z.number(),
  teamId: z.number().optional(),
});

export const ZDeleteTemplateMutationSchema = z.object({
  id: z.number().min(1),
});

export type TCreateTemplateMutationSchema = z.infer<typeof ZCreateTemplateMutationSchema>;
export type TCreateDocumentFromTemplateMutationSchema = z.infer<
  typeof ZCreateDocumentFromTemplateMutationSchema
>;

export type TDuplicateTemplateMutationSchema = z.infer<typeof ZDuplicateTemplateMutationSchema>;
export type TDeleteTemplateMutationSchema = z.infer<typeof ZDeleteTemplateMutationSchema>;
