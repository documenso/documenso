import { BRANDING_CSS_MAX_LENGTH } from '@documenso/lib/constants/branding';
import { ZEnvelopeExpirationPeriod } from '@documenso/lib/constants/envelope-expiration';
import { ZEnvelopeReminderSettings } from '@documenso/lib/constants/envelope-reminder';
import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { ZCssVarsSchema } from '@documenso/lib/types/css-vars';
import { ZDefaultRecipientsSchema } from '@documenso/lib/types/default-recipients';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { ZDocumentMetaDateFormatSchema, ZDocumentMetaTimezoneSchema } from '@documenso/lib/types/document-meta';
import { DocumentVisibility } from '@documenso/lib/types/document-visibility';
import { ZSanitizeBrandingCssWarningSchema } from '@documenso/lib/utils/sanitize-branding-css';
import { zEmail } from '@documenso/lib/utils/zod';
import { z } from 'zod';

export const ZUpdateOrganisationSettingsRequestSchema = z.object({
  organisationId: z.string(),

  /**
   * Required (as `true`) when the update reduces an active 2FA enforcement
   * grace window, so the client explicitly acknowledges that members lose
   * remaining grace time.
   */
  acknowledgeGracePeriodReduction: z.boolean().optional(),
  data: z.object({
    // Document related settings.
    documentVisibility: z.nativeEnum(DocumentVisibility).optional(),
    documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
    documentTimezone: ZDocumentMetaTimezoneSchema.nullish(), // Null means local timezone.
    documentDateFormat: ZDocumentMetaDateFormatSchema.optional(),
    includeSenderDetails: z.boolean().optional(),
    includeSigningCertificate: z.boolean().optional(),
    includeAuditLog: z.boolean().optional(),
    typedSignatureEnabled: z.boolean().optional(),
    uploadSignatureEnabled: z.boolean().optional(),
    drawSignatureEnabled: z.boolean().optional(),
    defaultRecipients: ZDefaultRecipientsSchema.nullish(),
    delegateDocumentOwnership: z.boolean().nullish(),
    envelopeExpirationPeriod: ZEnvelopeExpirationPeriod.optional(),
    reminderSettings: ZEnvelopeReminderSettings.optional(),

    // Branding related settings.
    brandingEnabled: z.boolean().optional(),
    brandingUrl: z.string().optional(),
    brandingCompanyDetails: z.string().optional(),
    brandingColors: ZCssVarsSchema.nullish(),
    brandingCss: z.string().max(BRANDING_CSS_MAX_LENGTH).optional(),

    // Email related settings.
    emailId: z.string().nullish(),
    emailReplyTo: zEmail().nullish(),
    // emailReplyToName: z.string().optional(),
    emailDocumentSettings: ZDocumentEmailSettingsSchema.optional(),

    // AI features settings.
    aiFeaturesEnabled: z.boolean().optional(),

    // 2FA enforcement settings. Touching these requires the
    // MANAGE_ORGANISATION_SECURITY permission (ADMIN only).
    twoFactorRequired: z.boolean().optional(),
    twoFactorGracePeriodDays: z.number().int().min(0).max(365).optional(),
  }),
});

export const ZUpdateOrganisationSettingsResponseSchema = z.object({
  cssWarnings: z.array(ZSanitizeBrandingCssWarningSchema).optional(),
});
