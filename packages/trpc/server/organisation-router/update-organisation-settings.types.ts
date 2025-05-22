import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { DocumentVisibility } from '@documenso/lib/types/document-visibility';

export const ZUpdateOrganisationSettingsRequestSchema = z.object({
  organisationId: z.string(),
  data: z.object({
    // Document related settings.
    documentVisibility: z.nativeEnum(DocumentVisibility).optional(),
    documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
    includeSenderDetails: z.boolean().optional(),
    includeSigningCertificate: z.boolean().optional(),
    typedSignatureEnabled: z.boolean().optional(),
    uploadSignatureEnabled: z.boolean().optional(),
    drawSignatureEnabled: z.boolean().optional(),

    // Branding related settings.
    brandingEnabled: z.boolean().optional(),
    brandingLogo: z.string().optional(),
    brandingUrl: z.string().optional(),
    brandingCompanyDetails: z.string().optional(),
  }),
});

export const ZUpdateOrganisationSettingsResponseSchema = z.void();
