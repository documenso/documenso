import { TeamMemberRole } from '@documenso/prisma/client';

export const TEAM_MEMBER_ROLE_MAP: Record<keyof typeof TeamMemberRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
};

export const TEAM_MEMBER_ROLE_PERMISSIONS_MAP = {
  /**
   * Includes updating team name, url, logo, emails.
   *
   * Todo: Teams - Clean this up, merge etc.
   */
  MANAGE_TEAM: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER],
  DELETE_INVITATIONS: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER],
  DELETE_TEAM_MEMBERS: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER],
  DELETE_TEAM_TRANSFER_REQUEST: [TeamMemberRole.ADMIN],
  UPDATE_TEAM_MEMBERS: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER],
} satisfies Record<string, TeamMemberRole[]>;

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
