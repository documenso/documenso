import type { Prisma } from '@prisma/client';
import { OrganisationType } from '@prisma/client';
import { OrganisationMemberRole } from '@prisma/client';

import { createCustomer } from '@documenso/ee/server-only/stripe/create-customer';
import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../constants/app';
import { ORGANISATION_INTERNAL_GROUPS } from '../../constants/organisations';
import { AppErrorCode } from '../../errors/app-error';
import { AppError } from '../../errors/app-error';
import type { InternalClaim } from '../../types/subscription';
import { INTERNAL_CLAIM_ID, internalClaims } from '../../types/subscription';
import { generateDatabaseId, prefixedId } from '../../universal/id';
import { generateDefaultOrganisationSettings } from '../../utils/organisations';
import { createTeam } from '../team/create-team';

type CreateOrganisationOptions = {
  userId: number;
  name: string;
  type: OrganisationType;
  url?: string;
  customerId?: string;
  claim: InternalClaim;
};

export const createOrganisation = async ({
  name,
  url,
  type,
  userId,
  customerId,
  claim,
}: CreateOrganisationOptions) => {
  let customerIdToUse = customerId;

  if (!customerId && IS_BILLING_ENABLED()) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User not found',
      });
    }

    customerIdToUse = await createCustomer({
      name: user.name || user.email,
      email: user.email,
    })
      .then((customer) => customer.id)
      .catch((err) => {
        console.error(err);

        return undefined;
      });
  }

  return await prisma.$transaction(async (tx) => {
    const organisationSetting = await tx.organisationGlobalSettings.create({
      data: {
        ...generateDefaultOrganisationSettings(),
        id: generateDatabaseId('org_setting'),
      },
    });

    const organisationClaim = await tx.organisationClaim.create({
      data: {
        id: generateDatabaseId('org_claim'),
        originalSubscriptionClaimId: claim.id,
        ...createOrganisationClaimUpsertData(claim),
      },
    });

    const organisationAuthenticationPortal = await tx.organisationAuthenticationPortal.create({
      data: {
        id: generateDatabaseId('org_sso'),
        enabled: false,
        clientId: '',
        clientSecret: '',
        wellKnownUrl: '',
      },
    });

    const orgIdAndUrl = prefixedId('org');

    const organisation = await tx.organisation
      .create({
        data: {
          id: orgIdAndUrl,
          name,
          type,
          url: url || orgIdAndUrl,
          ownerUserId: userId,
          organisationGlobalSettingsId: organisationSetting.id,
          organisationClaimId: organisationClaim.id,
          organisationAuthenticationPortalId: organisationAuthenticationPortal.id,
          groups: {
            create: ORGANISATION_INTERNAL_GROUPS.map((group) => ({
              ...group,
              id: generateDatabaseId('org_group'),
            })),
          },
          customerId: customerIdToUse,
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
        id: generateDatabaseId('member'),
        userId,
        organisationId: organisation.id,
        organisationGroupMembers: {
          create: {
            id: generateDatabaseId('group_member'),
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
  type?: OrganisationType;
};

export const createPersonalOrganisation = async ({
  userId,
  orgUrl,
  throwErrorOnOrganisationCreationFailure = false,
  inheritMembers = true,
  type = OrganisationType.PERSONAL,
}: CreatePersonalOrganisationOptions) => {
  const organisation = await createOrganisation({
    name: 'Personal Organisation',
    userId,
    url: orgUrl,
    type,
    claim: internalClaims[INTERNAL_CLAIM_ID.FREE],
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

export const createOrganisationClaimUpsertData = (subscriptionClaim: InternalClaim) => {
  // Done like this to ensure type errors are thrown if items are added.
  const data: Omit<
    Prisma.SubscriptionClaimCreateInput,
    'id' | 'createdAt' | 'updatedAt' | 'locked' | 'name'
  > = {
    flags: {
      ...subscriptionClaim.flags,
    },
    envelopeItemCount: subscriptionClaim.envelopeItemCount,
    teamCount: subscriptionClaim.teamCount,
    memberCount: subscriptionClaim.memberCount,
  };

  return {
    ...data,
  };
};
