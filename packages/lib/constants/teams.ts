import { OrganisationGroupType, TeamMemberRole } from '@prisma/client';

export const TEAM_URL_ROOT_REGEX = new RegExp('^/t/[^/]+/?$');
export const TEAM_URL_REGEX = new RegExp('^/t/[^/]+');

export const LOWEST_TEAM_ROLE = TeamMemberRole.MEMBER;

export const ALLOWED_TEAM_GROUP_TYPES: OrganisationGroupType[] = [
  OrganisationGroupType.CUSTOM,
  OrganisationGroupType.INTERNAL_ORGANISATION,
];

export const TEAM_INTERNAL_GROUPS: {
  teamRole: TeamMemberRole;
  type: OrganisationGroupType;
}[] = [
  {
    teamRole: TeamMemberRole.ADMIN,
    type: OrganisationGroupType.INTERNAL_TEAM,
  },
  {
    teamRole: TeamMemberRole.MANAGER,
    type: OrganisationGroupType.INTERNAL_TEAM,
  },
  {
    teamRole: TeamMemberRole.MEMBER,
    type: OrganisationGroupType.INTERNAL_TEAM,
  },
] as const;

export const TEAM_MEMBER_ROLE_PERMISSIONS_MAP = {
  DELETE_TEAM: [TeamMemberRole.ADMIN],
  MANAGE_TEAM: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER],
} satisfies Record<string, TeamMemberRole[]>;

/**
 * A hierarchy of team member roles to determine which role has higher permission than another.
 *
 * Warning: The length of the array is used to determine the priority of the role.
 * See `getHighestTeamRoleInGroup`
 */
export const TEAM_MEMBER_ROLE_HIERARCHY = {
  [TeamMemberRole.ADMIN]: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER, TeamMemberRole.MEMBER],
  [TeamMemberRole.MANAGER]: [TeamMemberRole.MANAGER, TeamMemberRole.MEMBER],
  [TeamMemberRole.MEMBER]: [TeamMemberRole.MEMBER],
} satisfies Record<TeamMemberRole, TeamMemberRole[]>;

export const PROTECTED_TEAM_URLS = [
  '403',
  '404',
  '500',
  '502',
  '503',
  '504',
  'about',
  'account',
  'admin',
  'administrator',
  'api',
  'app',
  'archive',
  'auth',
  'backup',
  'config',
  'configure',
  'contact',
  'contact-us',
  'copyright',
  'crime',
  'criminal',
  'dashboard',
  'docs',
  'documenso',
  'documentation',
  'document',
  'documents',
  'error',
  'exploit',
  'exploitation',
  'exploiter',
  'feedback',
  'finance',
  'forgot-password',
  'fraud',
  'fraudulent',
  'hack',
  'hacker',
  'harassment',
  'help',
  'helpdesk',
  'illegal',
  'internal',
  'legal',
  'login',
  'logout',
  'maintenance',
  'malware',
  'newsletter',
  'policy',
  'privacy',
  'profile',
  'public',
  'reset-password',
  'scam',
  'scammer',
  'settings',
  'setup',
  'sign',
  'signin',
  'signout',
  'signup',
  'spam',
  'support',
  'system',
  'team',
  'terms',
  'virus',
  'webhook',
];
