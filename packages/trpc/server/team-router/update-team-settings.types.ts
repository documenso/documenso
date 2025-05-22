import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { DocumentVisibility } from '@documenso/lib/types/document-visibility';

/**
 * Null = Inherit from organisation.
 * Undefined = Do nothing
 */
export const ZUpdateTeamSettingsRequestSchema = z.object({
  teamId: z.number(),
  data: z.object({
    // Document related settings.
    documentVisibility: z.nativeEnum(DocumentVisibility).nullish(),
    documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).nullish(),
    includeSenderDetails: z.boolean().nullish(),
    includeSigningCertificate: z.boolean().nullish(),
    typedSignatureEnabled: z.boolean().nullish(),
    uploadSignatureEnabled: z.boolean().nullish(),
    drawSignatureEnabled: z.boolean().nullish(),

    // Branding related settings.
    // Todo: Current disabled for now.
    // brandingEnabled: z.boolean().nullish(),
    // brandingLogo: z.string().nullish(),
    // brandingUrl: z.string().nullish(),
    // brandingCompanyDetails: z.string().nullish(),
  }),
});

export const ZUpdateTeamSettingsResponseSchema = z.void();
