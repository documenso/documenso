import { TeamMemberRole } from '@documenso/prisma/client';

export const TEAM_URL_ROOT_REGEX = new RegExp('^/t/[^/]+$');
export const TEAM_URL_REGEX = new RegExp('^/t/[^/]+');

export const TEAM_MEMBER_ROLE_MAP: Record<keyof typeof TeamMemberRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
};

export const TEAM_MEMBER_ROLE_PERMISSIONS_MAP = {
  /**
   * Includes permissions to:
   * - Manage team members
   * - Manage team settings, changing name, url, etc.
   */
  MANAGE_TEAM: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER],
  MANAGE_BILLING: [TeamMemberRole.ADMIN],
  DELETE_TEAM_TRANSFER_REQUEST: [TeamMemberRole.ADMIN],
} satisfies Record<string, TeamMemberRole[]>;

/**
 * A hierarchy of team member roles to determine which role has higher permission than another.
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
