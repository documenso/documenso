import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { updateTeamDocumentSettings } from '@documenso/lib/server-only/team/update-team-document-settings';
import { DocumentVisibility } from '@documenso/prisma/client';

import { authenticatedProcedure } from '../trpc';

export const ZUpdateTeamDocumentSettingsRequestSchema = z.object({
  teamId: z.number(),
  settings: z.object({
    documentVisibility: z
      .nativeEnum(DocumentVisibility)
      .optional()
      .default(DocumentVisibility.EVERYONE),
    documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).optional().default('en'),
    includeSenderDetails: z.boolean().optional().default(false),
    typedSignatureEnabled: z.boolean().optional().default(true),
    includeSigningCertificate: z.boolean().optional().default(true),
  }),
});

export const updateTeamDocumentSettingsRoute = authenticatedProcedure
  .input(ZUpdateTeamDocumentSettingsRequestSchema)
  .mutation(async ({ ctx, input }) => {
    const { teamId, settings } = input;

    return await updateTeamDocumentSettings({
      userId: ctx.user.id,
      teamId,
      settings,
    });
  });
