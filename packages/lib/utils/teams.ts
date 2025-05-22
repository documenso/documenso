import type { OrganisationGlobalSettings, Prisma, TeamGlobalSettings } from '@prisma/client';

import type { TeamGroup } from '@documenso/prisma/generated/types';
import type { TeamMemberRole } from '@documenso/prisma/generated/types';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import {
  LOWEST_TEAM_ROLE,
  TEAM_MEMBER_ROLE_HIERARCHY,
  TEAM_MEMBER_ROLE_PERMISSIONS_MAP,
} from '../constants/teams';
import type { TEAM_MEMBER_ROLE_MAP } from '../constants/teams-translations';

/**
 * Workaround for E2E tests to not import `msg`.
 */
export enum DocumentSignatureType {
  DRAW = 'draw',
  TYPE = 'type',
  UPLOAD = 'upload',
}

export const formatTeamUrl = (teamUrl: string, baseUrl?: string) => {
  const formattedBaseUrl = (baseUrl ?? NEXT_PUBLIC_WEBAPP_URL()).replace(/https?:\/\//, '');

  return `${formattedBaseUrl}/t/${teamUrl}`;
};

export const formatDocumentsPath = (teamUrl?: string) => {
  return teamUrl ? `/t/${teamUrl}/documents` : '/documents';
};

export const formatTemplatesPath = (teamUrl?: string) => {
  return teamUrl ? `/t/${teamUrl}/templates` : '/templates';
};

/**
 * Determines whether a team member can execute a given action.
 *
 * @param action The action the user is trying to execute.
 * @param role The current role of the user.
 * @returns Whether the user can execute the action.
 */
export const canExecuteTeamAction = (
  action: keyof typeof TEAM_MEMBER_ROLE_PERMISSIONS_MAP,
  role: keyof typeof TEAM_MEMBER_ROLE_MAP,
) => {
  return TEAM_MEMBER_ROLE_PERMISSIONS_MAP[action].some((i) => i === role);
};

/**
 * Compares the provided `currentUserRole` with the provided `roleToCheck` to determine
 * whether the `currentUserRole` has permission to modify the `roleToCheck`.
 *
 * @param currentUserRole Role of the current user
 * @param roleToCheck Role of another user to see if the current user can modify
 * @returns True if the current user can modify the other user, false otherwise
 */
export const isTeamRoleWithinUserHierarchy = (
  currentUserRole: keyof typeof TEAM_MEMBER_ROLE_MAP,
  roleToCheck: keyof typeof TEAM_MEMBER_ROLE_MAP,
) => {
  return TEAM_MEMBER_ROLE_HIERARCHY[currentUserRole].some((i) => i === roleToCheck);
};

export const getHighestTeamRoleInGroup = (groups: TeamGroup[]): TeamMemberRole => {
  let highestTeamRole: TeamMemberRole = LOWEST_TEAM_ROLE;

  groups.forEach((group) => {
    const currentRolePriority = TEAM_MEMBER_ROLE_HIERARCHY[group.teamRole].length;
    const highestTeamRolePriority = TEAM_MEMBER_ROLE_HIERARCHY[highestTeamRole].length;

    if (currentRolePriority > highestTeamRolePriority) {
      highestTeamRole = group.teamRole;
    }
  });

  return highestTeamRole;
};

export const extractTeamSignatureSettings = (
  settings?: {
    typedSignatureEnabled: boolean | null;
    drawSignatureEnabled: boolean | null;
    uploadSignatureEnabled: boolean | null;
  } | null,
) => {
  if (!settings) {
    return [DocumentSignatureType.TYPE, DocumentSignatureType.UPLOAD, DocumentSignatureType.DRAW];
  }

  const signatureTypes: DocumentSignatureType[] = [];

  if (settings.typedSignatureEnabled) {
    signatureTypes.push(DocumentSignatureType.TYPE);
  }

  if (settings.drawSignatureEnabled) {
    signatureTypes.push(DocumentSignatureType.DRAW);
  }

  if (settings.uploadSignatureEnabled) {
    signatureTypes.push(DocumentSignatureType.UPLOAD);
  }

  return signatureTypes;
};

// Todo: orgs test
export const buildTeamWhereQuery = (
  teamId: number | undefined, // Todo: test if this is okay
  userId: number,
  roles?: TeamMemberRole[],
): Prisma.TeamWhereUniqueInput => {
  // Note: Not using inline ternary since typesafety breaks for some reason.
  if (!roles) {
    return {
      id: teamId,
      teamGroups: {
        some: {
          organisationGroup: {
            organisation: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        },
      },
    };
  }

  return {
    id: teamId,
    teamGroups: {
      some: {
        organisationGroup: {
          organisation: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
        teamRole: {
          in: roles,
        },
      },
    },
  };
};

/**
 * Majority of these are null which lets us inherit from the organisation settings.
 */
export const generateDefaultTeamSettings = (): Omit<TeamGlobalSettings, 'id' | 'team'> => {
  return {
    documentVisibility: null,
    documentLanguage: null,
    includeSenderDetails: null,
    includeSigningCertificate: null,

    typedSignatureEnabled: null,
    uploadSignatureEnabled: null,
    drawSignatureEnabled: null,

    brandingEnabled: null,
    brandingLogo: null,
    brandingUrl: null,
    brandingCompanyDetails: null,
  };
};

/**
 * Derive the final settings for a team.
 *
 * @param organisationSettings The organisation settings to inherit values from
 * @param teamSettings The team settings which can override the organisation settings
 */
export const extractDerivedTeamSettings = (
  organisationSettings: Omit<OrganisationGlobalSettings, 'id'>,
  teamSettings: Omit<TeamGlobalSettings, 'id'>,
): Omit<OrganisationGlobalSettings, 'id'> => {
  const derivedSettings: Omit<OrganisationGlobalSettings, 'id'> = {
    ...organisationSettings,
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  for (const key of Object.keys(derivedSettings) as (keyof typeof derivedSettings)[]) {
    const teamValue = teamSettings[key];

    if (teamValue !== null) {
      // @ts-expect-error Should work
      derivedSettings[key] = teamValue;
    }
  }

  return derivedSettings;
};
