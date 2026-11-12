import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';

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

export const LOWEST_ORGANISATION_ROLE = OrganisationMemberRole.MEMBER;

export const ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER = 'organisation-account-link';

export const ORGANISATION_USER_ACCOUNT_TYPE = 'org-oidc';
