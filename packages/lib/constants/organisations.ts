import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';

export const ORGANISATION_URL_ROOT_REGEX = new RegExp('^/t/[^/]+/?$');
export const ORGANISATION_URL_REGEX = new RegExp('^/t/[^/]+');

export const ORGANISATION_INTERNAL_GROUPS: {
  organisationRole: OrganisationMemberRole;
  type: OrganisationGroupType;
}[] = [
  {
    organisationRole: OrganisationMemberRole.ADMIN,
    type: OrganisationGroupType.INTERNAL_ORGANISATION,
  },
  {
    organisationRole: OrganisationMemberRole.MANAGER,
    type: OrganisationGroupType.INTERNAL_ORGANISATION,
  },
  {
    organisationRole: OrganisationMemberRole.MEMBER,
    type: OrganisationGroupType.INTERNAL_ORGANISATION,
  },
] as const;

export const ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP = {
  /**
   * Includes permissions to:
   * - Manage organisation members
   * - Manage organisation settings, changing name, url, etc.
   */
  DELETE_ORGANISATION: [OrganisationMemberRole.ADMIN],
  MANAGE_BILLING: [OrganisationMemberRole.ADMIN],
  DELETE_ORGANISATION_TRANSFER_REQUEST: [OrganisationMemberRole.ADMIN],
  MANAGE_ORGANISATION: [OrganisationMemberRole.ADMIN, OrganisationMemberRole.MANAGER],
} satisfies Record<string, OrganisationMemberRole[]>;

/**
 * A hierarchy of organisation member roles to determine which role has higher permission than another.
 *
 * Warning: The length of the array is used to determine the priority of the role.
 * See `getHighestOrganisationRoleInGroup`
 */
export const ORGANISATION_MEMBER_ROLE_HIERARCHY = {
  [OrganisationMemberRole.ADMIN]: [
    OrganisationMemberRole.ADMIN,
    OrganisationMemberRole.MANAGER,
    OrganisationMemberRole.MEMBER,
  ],
  [OrganisationMemberRole.MANAGER]: [OrganisationMemberRole.MANAGER, OrganisationMemberRole.MEMBER],
  [OrganisationMemberRole.MEMBER]: [OrganisationMemberRole.MEMBER],
} satisfies Record<OrganisationMemberRole, OrganisationMemberRole[]>;

/**
 * A hierarchy of organisation member roles to determine which role has higher permission than another.
 *
 * This is used to determine the highest role in a group.
 */
export const ORGANISATION_MEMBER_ROLE_HIERARCHY_ORDER = {
  [OrganisationMemberRole.ADMIN]: 0,
  [OrganisationMemberRole.MANAGER]: 1,
  [OrganisationMemberRole.MEMBER]: 2,
} satisfies Record<OrganisationMemberRole, number>;

export const LOWEST_ORGANISATION_ROLE = OrganisationMemberRole.MEMBER;

export const PROTECTED_ORGANISATION_URLS = [
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
  'organisation',
  'terms',
  'virus',
  'webhook',
];

export const isOrganisationUrlProtected = (url: string) => {
  return PROTECTED_ORGANISATION_URLS.some((protectedUrl) => url.startsWith(`/${protectedUrl}`));
};
