import type { OrganisationGlobalSettings, Prisma } from '@prisma/client';
import {
  DocumentVisibility,
  type OrganisationGroup,
  type OrganisationMemberRole,
} from '@prisma/client';

import type { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';

import {
  LOWEST_ORGANISATION_ROLE,
  ORGANISATION_MEMBER_ROLE_HIERARCHY,
  ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP,
} from '../constants/organisations';

/**
 * Determines whether a team member can execute a given action.
 *
 * @param action The action the user is trying to execute.
 * @param role The current role of the user.
 * @returns Whether the user can execute the action.
 */
export const canExecuteOrganisationAction = (
  action: keyof typeof ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP,
  role: keyof typeof ORGANISATION_MEMBER_ROLE_MAP,
) => {
  return ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP[action].some((i) => i === role);
};

/**
 * Compares the provided `currentUserRole` with the provided `roleToCheck` to determine
 * whether the `currentUserRole` has permission to modify the `roleToCheck`.
 *
 * @param currentUserRole Role of the current user
 * @param roleToCheck Role of another user to see if the current user can modify
 * @returns True if the current user can modify the other user, false otherwise
 */
export const isOrganisationRoleWithinUserHierarchy = (
  currentUserRole: keyof typeof ORGANISATION_MEMBER_ROLE_MAP,
  roleToCheck: keyof typeof ORGANISATION_MEMBER_ROLE_MAP,
) => {
  return ORGANISATION_MEMBER_ROLE_HIERARCHY[currentUserRole].some((i) => i === roleToCheck);
};

export const getHighestOrganisationRoleInGroup = (
  groups: Pick<OrganisationGroup, 'type' | 'organisationRole'>[],
): OrganisationMemberRole => {
  let highestOrganisationRole: OrganisationMemberRole = LOWEST_ORGANISATION_ROLE;

  groups.forEach((group) => {
    const currentRolePriority = ORGANISATION_MEMBER_ROLE_HIERARCHY[group.organisationRole].length;
    const highestOrganisationRolePriority =
      ORGANISATION_MEMBER_ROLE_HIERARCHY[highestOrganisationRole].length;

    if (currentRolePriority > highestOrganisationRolePriority) {
      highestOrganisationRole = group.organisationRole;
    }
  });

  return highestOrganisationRole;
};

// Todo: orgs test
export const buildOrganisationWhereQuery = (
  organisationId: string | undefined,
  userId: number,
  roles?: OrganisationMemberRole[],
): Prisma.OrganisationWhereInput => {
  // Note: Not using inline ternary since typesafety breaks for some reason.
  if (!roles) {
    return {
      id: organisationId,
      members: {
        some: {
          userId,
        },
      },
    };
  }

  return {
    id: organisationId,
    members: {
      some: {
        userId,
        organisationGroupMembers: {
          some: {
            group: {
              organisationRole: {
                in: roles,
              },
            },
          },
        },
      },
    },
  };
};

export const generateDefaultOrganisationSettings = (): Omit<
  OrganisationGlobalSettings,
  'id' | 'organisation'
> => {
  return {
    documentVisibility: DocumentVisibility.EVERYONE,
    documentLanguage: 'en',
    includeSenderDetails: true,
    includeSigningCertificate: true,

    typedSignatureEnabled: true,
    uploadSignatureEnabled: true,
    drawSignatureEnabled: true,

    brandingEnabled: false,
    brandingLogo: '',
    brandingUrl: '',
    brandingCompanyDetails: '',
  };
};
