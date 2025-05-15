import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { DocumentVisibility } from '@documenso/lib/types/document-visibility';
import TeamGlobalSettingsSchema from '@documenso/prisma/generated/zod/modelSchema/TeamGlobalSettingsSchema';

export const ZUpdateTeamDocumentSettingsRequestSchema = z.object({
  teamId: z.number(),
  settings: z.object({
    documentVisibility: z
      .nativeEnum(DocumentVisibility)
      .optional()
      .default(DocumentVisibility.EVERYONE),
    documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).optional().default('en'),
    includeSenderDetails: z.boolean().optional().default(false),
    includeSigningCertificate: z.boolean().optional().default(true),
    typedSignatureEnabled: z.boolean().optional().default(true),
    uploadSignatureEnabled: z.boolean().optional().default(true),
    drawSignatureEnabled: z.boolean().optional().default(true),
  }),
});

export const ZUpdateTeamDocumentSettingsResponseSchema = TeamGlobalSettingsSchema;
