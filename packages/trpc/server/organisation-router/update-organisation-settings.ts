import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateOrganisationSettingsRequestSchema,
  ZUpdateOrganisationSettingsResponseSchema,
} from './update-organisation-settings.types';

export const updateOrganisationSettingsRoute = authenticatedProcedure
  .input(ZUpdateOrganisationSettingsRequestSchema)
  .output(ZUpdateOrganisationSettingsResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    const { organisationId, data } = input;

    const {
      // Document related settings.
      documentVisibility,
      documentLanguage,
      includeSenderDetails,
      includeSigningCertificate,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
      // Branding related settings.
      brandingEnabled,
      brandingLogo,
      brandingUrl,
      brandingCompanyDetails,
    } = data;

    if (Object.values(data).length === 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'No settings to update',
      });
    }

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        user.id,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      ),
      include: {
        organisationGlobalSettings: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to update this organisation.',
      });
    }

    const derivedTypedSignatureEnabled =
      typedSignatureEnabled ?? organisation.organisationGlobalSettings.typedSignatureEnabled;
    const derivedUploadSignatureEnabled =
      uploadSignatureEnabled ?? organisation.organisationGlobalSettings.uploadSignatureEnabled;
    const derivedDrawSignatureEnabled =
      drawSignatureEnabled ?? organisation.organisationGlobalSettings.drawSignatureEnabled;

    if (
      derivedTypedSignatureEnabled === false &&
      derivedUploadSignatureEnabled === false &&
      derivedDrawSignatureEnabled === false
    ) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'At least one signature type must be enabled',
      });
    }

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
            includeSenderDetails,
            includeSigningCertificate,
            typedSignatureEnabled,
            uploadSignatureEnabled,
            drawSignatureEnabled,

            // Branding related settings.
            brandingEnabled,
            brandingLogo,
            brandingUrl,
            brandingCompanyDetails,
          },
        },
      },
    });
  });
