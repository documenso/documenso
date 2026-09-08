import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { normalizeBrandingColors } from '@documenso/lib/utils/normalize-branding-colors';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { type SanitizeBrandingCssWarning, sanitizeBrandingCss } from '@documenso/lib/utils/sanitize-branding-css';
import { isTwoFactorGracePeriodReduction, isTwoFactorSatisfied } from '@documenso/lib/utils/two-factor';
import { prisma } from '@documenso/prisma';
import { OrganisationType, Prisma, type Session } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  ZUpdateOrganisationSettingsRequestSchema,
  ZUpdateOrganisationSettingsResponseSchema,
} from './update-organisation-settings.types';

export const updateOrganisationSettingsRoute = authenticatedProcedure
  .input(ZUpdateOrganisationSettingsRequestSchema)
  .output(ZUpdateOrganisationSettingsResponseSchema)
  .use(twoFactorScope((input) => ({ organisation: input.organisationId })))
  .mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { organisationId, data, acknowledgeGracePeriodReduction } = input;

    // Explicitly asserted local: `ctx.session` is null for API-token callers.
    // The assertion (rather than an annotation) avoids control-flow narrowing
    // differences between workspace tsconfigs.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const requestSession = ctx.session as Pick<Session, 'twoFactorVerified'> | null;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const {
      // Document related settings.
      documentVisibility,
      documentLanguage,
      documentTimezone,
      documentDateFormat,
      includeSenderDetails,
      includeSigningCertificate,
      includeAuditLog,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
      defaultRecipients,
      delegateDocumentOwnership,
      envelopeExpirationPeriod,
      reminderSettings,

      // Branding related settings.
      brandingEnabled,
      brandingUrl,
      brandingCompanyDetails,
      brandingColors,
      brandingCss,

      // Email related settings.
      emailId,
      emailReplyTo,
      // emailReplyToName,
      emailDocumentSettings,

      // AI features settings.
      aiFeaturesEnabled,

      // 2FA enforcement settings.
      twoFactorRequired,
      twoFactorGracePeriodDays,
    } = data;

    if (Object.values(data).length === 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'No settings to update',
      });
    }

    const isTouchingTwoFactorSettings = twoFactorRequired !== undefined || twoFactorGracePeriodDays !== undefined;

    // Touching the 2FA enforcement fields requires the stricter
    // MANAGE_ORGANISATION_SECURITY permission (ADMIN only). All other fields
    // keep MANAGE_ORGANISATION.
    const requiredRoles = isTouchingTwoFactorSettings
      ? ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION_SECURITY']
      : ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'];

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: requiredRoles,
      }),
      include: {
        organisationGlobalSettings: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to update this organisation.',
      });
    }

    const currentSettings = organisation.organisationGlobalSettings;

    // Server-side `twoFactorEnforcedFrom` handling: set on each off→on
    // transition of the require flag, preserved otherwise.
    const isEnablingTwoFactorRequired = twoFactorRequired === true && !currentSettings.twoFactorRequired;

    let twoFactorEnforcedFrom: Date | undefined;

    if (isTouchingTwoFactorSettings) {
      const now = new Date();

      if (isEnablingTwoFactorRequired) {
        twoFactorEnforcedFrom = now;
      }

      // Enable-time guard: enabling enforcement requires the acting user to
      // already satisfy the policy being enabled. This prevents self-lockout
      // (a 0-day grace would instantly block the actor from the very settings
      // route that undoes it) and removes the instant-DoS lever of enabling a
      // policy the actor themselves cannot pass. API-token callers carry no
      // session and can never prove a verified second factor, so they cannot
      // enable enforcement either.
      if (isEnablingTwoFactorRequired) {
        const isActingUserSatisfied = isTwoFactorSatisfied({
          userTwoFactorEnabled: user.twoFactorEnabled,
          sessionTwoFactorVerified: requestSession?.twoFactorVerified ?? false,
        });

        if (!isActingUserSatisfied) {
          throw new AppError(AppErrorCode.TWO_FACTOR_REQUIRED, {
            message:
              'You must have two-factor authentication enabled and verified on this session before requiring it for the organisation.',
            statusCode: 403,
          });
        }
      }

      // Grace-reduction acknowledgement: when the change shortens an active
      // grace window, require an explicit acknowledgement from the client.
      const nextTwoFactorRequired = twoFactorRequired ?? currentSettings.twoFactorRequired;
      const nextGracePeriodDays = twoFactorGracePeriodDays ?? currentSettings.twoFactorGracePeriodDays;
      const nextEnforcedFrom = twoFactorEnforcedFrom ?? currentSettings.twoFactorEnforcedFrom;

      const isGraceReduction = isTwoFactorGracePeriodReduction({
        previous: currentSettings.twoFactorRequired
          ? {
              anchors: [currentSettings.twoFactorEnforcedFrom],
              gracePeriodDays: currentSettings.twoFactorGracePeriodDays,
            }
          : null,
        next: nextTwoFactorRequired
          ? {
              anchors: [nextEnforcedFrom],
              gracePeriodDays: nextGracePeriodDays,
            }
          : null,
        now,
      });

      if (isGraceReduction && acknowledgeGracePeriodReduction !== true) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message:
            'This change reduces the active two-factor authentication grace period and must be explicitly acknowledged.',
        });
      }
    }

    // Validate that the email ID belongs to the organisation.
    if (emailId) {
      const email = await prisma.organisationEmail.findFirst({
        where: {
          id: emailId,
          organisationId,
        },
      });

      if (!email) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Email not found',
        });
      }
    }

    const derivedTypedSignatureEnabled =
      typedSignatureEnabled ?? organisation.organisationGlobalSettings.typedSignatureEnabled;
    const derivedUploadSignatureEnabled =
      uploadSignatureEnabled ?? organisation.organisationGlobalSettings.uploadSignatureEnabled;
    const derivedDrawSignatureEnabled =
      drawSignatureEnabled ?? organisation.organisationGlobalSettings.drawSignatureEnabled;

    const derivedDelegateDocumentOwnership =
      delegateDocumentOwnership ?? organisation.organisationGlobalSettings.delegateDocumentOwnership;

    if (
      derivedTypedSignatureEnabled === false &&
      derivedUploadSignatureEnabled === false &&
      derivedDrawSignatureEnabled === false
    ) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'At least one signature type must be enabled',
      });
    }

    const isPersonalOrganisation = organisation.type === OrganisationType.PERSONAL;
    const currentIncludeSenderDetails = organisation.organisationGlobalSettings.includeSenderDetails;

    const isChangingIncludeSenderDetails =
      includeSenderDetails !== undefined && includeSenderDetails !== currentIncludeSenderDetails;

    // Personal teams cannot change the sender details — drop the field (no-op)
    // instead of rejecting the whole update.
    const derivedIncludeSenderDetails =
      isPersonalOrganisation && isChangingIncludeSenderDetails ? undefined : includeSenderDetails;

    // Sanitize custom branding CSS at write time so we can store the safe
    // result and skip per-render sanitisation. Warnings are returned to the
    // UI so the user can see what was dropped.
    let cssWarnings: SanitizeBrandingCssWarning[] | undefined;
    let sanitizedBrandingCss: string | undefined;

    if (brandingCss !== undefined) {
      const result = sanitizeBrandingCss(brandingCss);
      sanitizedBrandingCss = result.css;
      cssWarnings = result.warnings;
    }

    // Strip empty-string colour values; collapse to `null` when the payload
    // contains no overrides. Keeps the stored row clean and avoids storing
    // `{}` as a real "override of nothing" (matters more for teams, but the
    // org row stays tidy this way too).
    const normalizedBrandingColors = normalizeBrandingColors(brandingColors);

    await prisma.organisation.update({
      where: {
        id: organisationId,
      },
      data: {
        organisationGlobalSettings: {
          update: {
            // Document related settings.
            documentVisibility,
            documentLanguage,
            documentTimezone,
            documentDateFormat,
            includeSenderDetails: derivedIncludeSenderDetails,
            includeSigningCertificate,
            includeAuditLog,
            typedSignatureEnabled,
            uploadSignatureEnabled,
            drawSignatureEnabled,
            defaultRecipients: defaultRecipients === null ? Prisma.DbNull : defaultRecipients,
            delegateDocumentOwnership: derivedDelegateDocumentOwnership,
            envelopeExpirationPeriod: envelopeExpirationPeriod === null ? Prisma.DbNull : envelopeExpirationPeriod,
            reminderSettings: reminderSettings === null ? Prisma.DbNull : reminderSettings,

            // Branding related settings.
            brandingEnabled,
            brandingUrl,
            brandingCompanyDetails,
            brandingColors: normalizedBrandingColors === null ? Prisma.DbNull : normalizedBrandingColors,
            brandingCss: sanitizedBrandingCss,

            // Email related settings.
            emailId,
            emailReplyTo,
            // emailReplyToName,
            emailDocumentSettings,

            // AI features settings.
            aiFeaturesEnabled,

            // 2FA enforcement settings. `twoFactorEnforcedFrom` is only set
            // on an off→on transition (undefined preserves the stored value).
            twoFactorRequired,
            twoFactorGracePeriodDays,
            twoFactorEnforcedFrom,
          },
        },
      },
    });

    return {
      cssWarnings: cssWarnings && cssWarnings.length > 0 ? cssWarnings : undefined,
    };
  });
