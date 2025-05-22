import { OrganisationMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { ORGANISATION_INTERNAL_GROUPS } from '../../constants/organisations';
import { AppErrorCode } from '../../errors/app-error';
import { AppError } from '../../errors/app-error';
import { prefixedId } from '../../universal/id';
import { generateDefaultOrganisationSettings } from '../../utils/organisations';
import { generateDefaultOrganisationClaims } from '../../utils/organisations-claims';
import { createTeam } from '../team/create-team';

type CreateOrganisationOptions = {
  userId: number;
  name: string;
  url?: string;
  customerId?: string;
};

export const createOrganisation = async ({
  name,
  url,
  userId,
  customerId,
}: CreateOrganisationOptions) => {
  return await prisma.$transaction(async (tx) => {
    const organisationSetting = await tx.organisationGlobalSettings.create({
      data: generateDefaultOrganisationSettings(),
    });

    const organisationClaim = await tx.organisationClaim.create({
      data: generateDefaultOrganisationClaims(),
    });

    const organisation = await tx.organisation
      .create({
        data: {
          name,
          url: url || prefixedId('org'),
          ownerUserId: userId,
          organisationGlobalSettingsId: organisationSetting.id,
          organisationClaimId: organisationClaim.id,
          groups: {
            create: ORGANISATION_INTERNAL_GROUPS,
          },
          customerId,
        },
        include: {
          groups: true,
        },
      })
      .catch((err) => {
        if (err.code === 'P2002') {
          throw new AppError(AppErrorCode.ALREADY_EXISTS, {
            message: 'Organisation URL already exists',
          });
        }

        throw err;
      });

    const adminGroup = organisation.groups.find(
      (group) => group.organisationRole === OrganisationMemberRole.ADMIN,
    );

    if (!adminGroup) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Admin group not found',
      });
    }

    await tx.organisationMember.create({
      data: {
        userId,
        organisationId: organisation.id,
        organisationGroupMembers: {
          create: {
            groupId: adminGroup.id,
          },
        },
      },
    });

    return organisation;
  });
};

type CreatePersonalOrganisationOptions = {
  userId: number;
  orgUrl?: string;
  throwErrorOnOrganisationCreationFailure?: boolean;
  inheritMembers?: boolean;
};

export const createPersonalOrganisation = async ({
  userId,
  orgUrl,
  throwErrorOnOrganisationCreationFailure = false,
  inheritMembers = true,
}: CreatePersonalOrganisationOptions) => {
  const organisation = await createOrganisation({
    name: 'Personal Organisation',
    userId,
    url: orgUrl,
  }).catch((err) => {
    console.error(err);

    if (throwErrorOnOrganisationCreationFailure) {
      throw err;
    }

    // Todo: (LOGS)
  });

  if (organisation) {
    await createTeam({
      userId,
      teamName: 'Personal Team',
      teamUrl: prefixedId('personal'),
      organisationId: organisation.id,
      inheritMembers,
    }).catch((err) => {
      console.error(err);

      // Todo: (LOGS)
    });
  }

  return organisation;
};
