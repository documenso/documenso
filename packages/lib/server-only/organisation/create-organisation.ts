import { OrganisationMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { ORGANISATION_INTERNAL_GROUPS } from '../../constants/organisations';
import { AppErrorCode } from '../../errors/app-error';
import { AppError } from '../../errors/app-error';
import { alphaid } from '../../universal/id';
import { generateDefaultOrganisationSettings } from '../../utils/organisations';
import { createTeam } from '../team/create-team';

type CreateOrganisationOptions = {
  userId: number;
  name: string;
  url: string;
};

export const createOrganisation = async ({ name, url, userId }: CreateOrganisationOptions) => {
  return await prisma.$transaction(async (tx) => {
    const organisationSetting = await tx.organisationGlobalSettings.create({
      data: generateDefaultOrganisationSettings(),
    });

    const organisation = await tx.organisation
      .create({
        data: {
          name,
          url, // Todo: orgs constraint this
          ownerUserId: userId,
          organisationGlobalSettingsId: organisationSetting.id,
          groups: {
            create: ORGANISATION_INTERNAL_GROUPS,
          },
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
};

export const createPersonalOrganisation = async ({
  userId,
  orgUrl,
  throwErrorOnOrganisationCreationFailure = false,
}: CreatePersonalOrganisationOptions) => {
  const organisation = await createOrganisation({
    name: 'Personal Organisation',
    userId,
    url: orgUrl || `org_${alphaid(8)}`,
  }).catch((err) => {
    console.error(err);

    if (throwErrorOnOrganisationCreationFailure) {
      throw err;
    }

    // Todo: (orgs) Add logging.
  });

  if (organisation) {
    await createTeam({
      userId,
      teamName: 'Personal Team',
      teamUrl: `personal_${alphaid(8)}`,
      organisationId: organisation.id,
      inheritMembers: true,
    }).catch((err) => {
      console.error(err);
      // Todo: (orgs) Add logging.
    });
  }

  return organisation;
};
