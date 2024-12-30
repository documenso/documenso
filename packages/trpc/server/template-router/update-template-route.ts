import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES, isValidLanguageCode } from '@documenso/lib/constants/i18n';
import { updateTemplateSettings } from '@documenso/lib/server-only/template/update-template-settings';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import { DocumentDistributionMethod, TemplateType } from '@documenso/prisma/client';
import { TemplateSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';
import { MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH, MAX_TEMPLATE_PUBLIC_TITLE_LENGTH } from './schema';

export const ZUpdateTemplateRequestSchema = z.object({
  templateId: z.number(),
  teamId: z.number().min(1).optional(),
  data: z.object({
    title: z.string().min(1).optional(),
    externalId: z.string().nullish(),
    globalAccessAuth: ZDocumentAccessAuthTypesSchema.nullable().optional(),
    globalActionAuth: ZDocumentActionAuthTypesSchema.nullable().optional(),
    publicTitle: z.string().trim().min(1).max(MAX_TEMPLATE_PUBLIC_TITLE_LENGTH).optional(),
    publicDescription: z
      .string()
      .trim()
      .min(1)
      .max(MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH)
      .optional(),
    type: z.nativeEnum(TemplateType).optional(),
    language: z
      .union([z.string(), z.enum(SUPPORTED_LANGUAGE_CODES)])
      .optional()
      .default('en'),
  }),
  meta: z
    .object({
      subject: z.string(),
      message: z.string(),
      timezone: z.string(),
      dateFormat: z.string(),
      distributionMethod: z.nativeEnum(DocumentDistributionMethod),
      emailSettings: ZDocumentEmailSettingsSchema,
      redirectUrl: z
        .string()
        .optional()
        .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
          message:
            'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
        }),
      language: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
      typedSignatureEnabled: z.boolean().optional(),
    })
    .optional(),
});

export const ZUpdateTemplateResponseSchema = TemplateSchema;

export const updateTemplateRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/{templateId}',
      summary: 'Update template',
      tags: ['Template'],
    },
  })
  .input(ZUpdateTemplateRequestSchema)
  .output(ZUpdateTemplateResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { templateId, teamId, data, meta } = input;

    const userId = ctx.user.id;

    const requestMetadata = extractNextApiRequestMetadata(ctx.req);

    return await updateTemplateSettings({
      userId,
      teamId,
      templateId,
      data,
      meta: {
        ...meta,
        language: isValidLanguageCode(meta?.language) ? meta?.language : undefined,
      },
      requestMetadata,
    });
  });
