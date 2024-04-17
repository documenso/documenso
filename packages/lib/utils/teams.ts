import { WEBAPP_BASE_URL } from '../constants/app';
import type { TEAM_MEMBER_ROLE_MAP } from '../constants/teams';
import { TEAM_MEMBER_ROLE_HIERARCHY, TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../constants/teams';

export const formatTeamUrl = (teamUrl: string, baseUrl?: string) => {
  const formattedBaseUrl = (baseUrl ?? WEBAPP_BASE_URL).replace(/https?:\/\//, '');

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
