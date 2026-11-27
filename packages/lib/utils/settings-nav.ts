import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { OrganisationMemberRole, TeamMemberRole } from '@prisma/client';
import {
  AlertTriangleIcon,
  BarChart3Icon,
  BracesIcon,
  Building2Icon,
  CreditCardIcon,
  FileStackIcon,
  Globe2Icon,
  GroupIcon,
  LineChartIcon,
  LockIcon,
  MailboxIcon,
  MailIcon,
  Settings2Icon,
  SettingsIcon,
  ShieldCheckIcon,
  TagIcon,
  TrophyIcon,
  UserIcon,
  Users2Icon,
  UsersIcon,
  Wallet2Icon,
  WebhookIcon,
  WorkflowIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { FaUsers } from 'react-icons/fa6';
import { IS_BILLING_ENABLED, IS_DOCUMENSO_CLOUD } from '../constants/app';
import { canExecuteOrganisationAction } from './organisations';
import { canExecuteTeamAction } from './teams';

export type SettingsNavScope = 'organisation' | 'team' | 'account' | 'admin';

export type SettingsNavItem = {
  key: string;
  path: string;

  /**
   * Other paths whose pages belong to this item, for pages with no nav item of their own.
   */
  activeOnPaths?: string[];
  label: MessageDescriptor;
  icon?: ComponentType<{ className?: string }>;
  isSubNav?: boolean;
  isSubNavParent?: boolean;
};

export type SettingsNavGroup = {
  scope: SettingsNavScope;
  /**
   * Heading for scopes split into several groups, such as admin. The organisation, team and
   * account headings are rendered by the sidebar itself, next to their switchers.
   */
  label?: MessageDescriptor;
  items: SettingsNavItem[];
};

export type SettingsNavGroups = {
  organisation: SettingsNavGroup | null;
  team: SettingsNavGroup | null;
  account: SettingsNavGroup;
};

export type UnifiedSettingsScope = keyof SettingsNavGroups;

export type GetSettingsNavGroupsArgs = {
  organisation: {
    url: string;
    currentOrganisationRole: OrganisationMemberRole;
    organisationClaim: { flags: { emailDomains?: boolean; authenticationPortal?: boolean } };
  } | null;
  team: {
    url: string;
    currentTeamRole: TeamMemberRole;
  } | null;
  hasManageableBillingOrgs: boolean;
};

/**
 * Build the nav-group structure for the unified settings sidebar.
 *
 * Pure data helper — given a current organisation, optional current team, and the billing-enabled
 * flag, returns the items that should appear in each scope group. Groups the user has no manage
 * permission for are returned as `null` (not empty arrays) so consumers can branch on visibility.
 *
 * Item ordering, claim-flag gating, and which sections are scope-specific are encoded here as the
 * single source of truth for the unified-settings sidebar.
 */
export const getSettingsNavGroups = ({
  organisation,
  team,
  hasManageableBillingOrgs,
}: GetSettingsNavGroupsArgs): SettingsNavGroups => {
  const isBillingEnabled = IS_BILLING_ENABLED();
  const isDocumensoCloud = IS_DOCUMENSO_CLOUD();

  const canManageOrg =
    organisation !== null && canExecuteOrganisationAction('MANAGE_ORGANISATION', organisation.currentOrganisationRole);

  const canManageTeam = team !== null && canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole);

  const orgGroup: SettingsNavGroup | null = canManageOrg
    ? {
        scope: 'organisation',
        items: [
          {
            key: 'general',
            path: `/o/${organisation.url}/settings/general`,
            label: msg`General`,
            icon: Building2Icon,
          },
          {
            key: 'preferences',
            path: `/o/${organisation.url}/settings/document`,
            label: msg`Preferences`,
            icon: Settings2Icon,
            isSubNavParent: true,
          },
          {
            key: 'preferences-document',
            path: `/o/${organisation.url}/settings/document`,
            label: msg`General`,
            isSubNav: true,
          },
          {
            key: 'preferences-branding',
            path: `/o/${organisation.url}/settings/branding`,
            label: msg`Branding`,
            isSubNav: true,
          },
          {
            key: 'preferences-email',
            path: `/o/${organisation.url}/settings/email`,
            label: msg`Email`,
            isSubNav: true,
          },
          {
            key: 'preferences-reminders',
            path: `/o/${organisation.url}/settings/reminders`,
            label: msg`Reminders`,
            isSubNav: true,
          },
          {
            key: 'preferences-certificates',
            path: `/o/${organisation.url}/settings/certificates`,
            label: msg`Certificates`,
            isSubNav: true,
          },
          ...((isBillingEnabled && organisation.organisationClaim.flags.emailDomains) || isDocumensoCloud
            ? [
                {
                  key: 'email-domains',
                  path: `/o/${organisation.url}/settings/email-domains`,
                  label: msg`Email Domains`,
                  icon: MailboxIcon,
                },
              ]
            : []),
          {
            key: 'teams',
            path: `/o/${organisation.url}/settings/teams`,
            label: msg`Teams`,
            icon: FaUsers,
          },
          {
            key: 'members',
            path: `/o/${organisation.url}/settings/members`,
            label: msg`Members`,
            icon: Users2Icon,
          },
          {
            key: 'groups',
            path: `/o/${organisation.url}/settings/groups`,
            label: msg`Groups`,
            icon: GroupIcon,
          },
          ...((isBillingEnabled && organisation.organisationClaim.flags.authenticationPortal) || isDocumensoCloud
            ? [
                {
                  key: 'sso',
                  path: `/o/${organisation.url}/settings/sso`,
                  label: msg`SSO`,
                  icon: ShieldCheckIcon,
                },
              ]
            : []),
          ...(isBillingEnabled
            ? [
                {
                  key: 'billing',
                  path: `/o/${organisation.url}/settings/billing`,
                  label: msg`Billing`,
                  icon: CreditCardIcon,
                },
              ]
            : []),
        ],
      }
    : null;

  const teamGroup: SettingsNavGroup | null =
    canManageTeam && team
      ? {
          scope: 'team',
          items: [
            {
              key: 'general',
              path: `/t/${team.url}/settings/general`,
              label: msg`General`,
              icon: SettingsIcon,
            },
            {
              key: 'preferences',
              path: `/t/${team.url}/settings/document`,
              label: msg`Preferences`,
              icon: Settings2Icon,
              isSubNavParent: true,
            },
            {
              key: 'preferences-document',
              path: `/t/${team.url}/settings/document`,
              label: msg`General`,
              isSubNav: true,
            },
            {
              key: 'preferences-branding',
              path: `/t/${team.url}/settings/branding`,
              label: msg`Branding`,
              isSubNav: true,
            },
            {
              key: 'preferences-email',
              path: `/t/${team.url}/settings/email`,
              label: msg`Email`,
              isSubNav: true,
            },
            {
              key: 'preferences-reminders',
              path: `/t/${team.url}/settings/reminders`,
              label: msg`Reminders`,
              isSubNav: true,
            },
            {
              key: 'preferences-certificates',
              path: `/t/${team.url}/settings/certificates`,
              label: msg`Certificates`,
              isSubNav: true,
            },
            {
              key: 'members',
              path: `/t/${team.url}/settings/members`,
              label: msg`Members`,
              icon: Users2Icon,
            },
            {
              key: 'groups',
              path: `/t/${team.url}/settings/groups`,
              label: msg`Groups`,
              icon: GroupIcon,
            },
            {
              key: 'public-profile',
              path: `/t/${team.url}/settings/public-profile`,
              label: msg`Public Profile`,
              icon: Globe2Icon,
            },
            {
              key: 'tokens',
              path: `/t/${team.url}/settings/tokens`,
              label: msg`API Tokens`,
              icon: BracesIcon,
            },
            {
              key: 'webhooks',
              path: `/t/${team.url}/settings/webhooks`,
              label: msg`Webhooks`,
              icon: WebhookIcon,
            },
          ],
        }
      : null;

  const accountGroup: SettingsNavGroup = {
    scope: 'account',
    items: [
      {
        key: 'profile',
        path: '/settings/profile',
        label: msg`Profile`,
        icon: UserIcon,
      },
      {
        key: 'organisations',
        path: '/settings/organisations',
        label: msg`Organisations`,
        icon: Building2Icon,
      },
      {
        key: 'security',
        path: '/settings/security',
        label: msg`Security`,
        icon: LockIcon,
      },
      ...(IS_BILLING_ENABLED() && hasManageableBillingOrgs
        ? [
            {
              key: 'billing',
              path: '/settings/billing',
              label: msg`Billing`,
              icon: CreditCardIcon,
            },
          ]
        : []),
    ],
  };

  return { organisation: orgGroup, team: teamGroup, account: accountGroup };
};

export const getAdminNavGroups = (): SettingsNavGroup[] => [
  {
    scope: 'admin',
    label: msg`Insights`,
    items: [
      {
        key: 'stats',
        path: '/admin/stats',
        label: msg`Stats`,
        icon: BarChart3Icon,
      },
      {
        key: 'organisation-insights',
        path: '/admin/organisation-insights',
        label: msg`Organisation Insights`,
        icon: TrophyIcon,
      },
      {
        key: 'organisation-stats',
        path: '/admin/organisation-stats',
        label: msg`Organisation Stats`,
        icon: LineChartIcon,
      },
    ],
  },
  {
    scope: 'admin',
    label: msg`Accounts`,
    items: [
      {
        key: 'organisations',
        path: '/admin/organisations',
        activeOnPaths: ['/admin/teams'],
        label: msg`Organisations`,
        icon: Building2Icon,
      },
      {
        key: 'users',
        path: '/admin/users',
        label: msg`Users`,
        icon: UsersIcon,
      },
    ],
  },
  {
    scope: 'admin',
    label: msg`Documents`,
    items: [
      {
        key: 'documents',
        path: '/admin/documents',
        label: msg`Documents`,
        icon: FileStackIcon,
      },
      {
        key: 'unsealed-documents',
        path: '/admin/unsealed-documents',
        label: msg`Unsealed Documents`,
        icon: AlertTriangleIcon,
      },
    ],
  },
  {
    scope: 'admin',
    label: msg`Platform`,
    items: [
      {
        key: 'claims',
        path: '/admin/claims',
        label: msg`Claims`,
        icon: Wallet2Icon,
      },
      {
        key: 'email-transports',
        path: '/admin/email-transports',
        label: msg`Email Transports`,
        icon: MailIcon,
      },
      {
        key: 'email-domains',
        path: '/admin/email-domains',
        label: msg`Email Domains`,
        icon: MailboxIcon,
      },
      ...(IS_DOCUMENSO_CLOUD()
        ? [
            {
              key: 'rules',
              path: '/admin/rules',
              label: msg`Rules`,
              icon: WorkflowIcon,
            },
            {
              key: 'tags',
              path: '/admin/tags',
              label: msg`Tags`,
              icon: TagIcon,
            },
          ]
        : []),
      {
        key: 'site-settings',
        path: '/admin/site-settings',
        label: msg`Site Settings`,
        icon: SettingsIcon,
      },
    ],
  },
];

const isPathWithin = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

/**
 * Find the nav item for the current page: the item whose path is the pathname or one of its
 * parents, preferring the longest so `/settings/security/passkeys` resolves to Security. Sub-nav
 * parents are skipped because they share their first child's path.
 */
export const findActiveSettingsNavItem = (items: SettingsNavItem[], pathname: string): SettingsNavItem | null => {
  let activeItem: SettingsNavItem | null = null;
  let activeMatchLength = 0;

  for (const item of items) {
    if (item.isSubNavParent) {
      continue;
    }

    for (const path of [item.path, ...(item.activeOnPaths ?? [])]) {
      if (isPathWithin(pathname, path) && path.length > activeMatchLength) {
        activeItem = item;
        activeMatchLength = path.length;
      }
    }
  }

  return activeItem;
};

/**
 * The parent a sub-nav item is listed under: the nearest `isSubNavParent` before it, which is
 * how the sidebar groups them.
 */
export const findSettingsNavParent = (items: SettingsNavItem[], target: SettingsNavItem): SettingsNavItem | null => {
  let parent: SettingsNavItem | null = null;

  for (const item of items) {
    if (item.isSubNavParent) {
      parent = item;
    } else if (!item.isSubNav) {
      parent = null;
    }

    if (item === target) {
      return item.isSubNav ? parent : null;
    }
  }

  return null;
};

export type ActiveSettingsNav = {
  group: SettingsNavGroup;
  item: SettingsNavItem;
};

/**
 * The nav item for the current page across all of a layout's groups, with the group it is in.
 * Layouts work this out once so the sidebar, section picker and breadcrumb can't disagree.
 */
export const findActiveSettingsNav = (groups: SettingsNavGroup[], pathname: string): ActiveSettingsNav | null => {
  const item = findActiveSettingsNavItem(
    groups.flatMap((group) => group.items),
    pathname,
  );

  const group = item ? groups.find((candidate) => candidate.items.includes(item)) : undefined;

  return item && group ? { group, item } : null;
};

/**
 * Breadcrumb labels for the current page, e.g. `['Preferences', 'Branding']` or `['Members']`.
 */
export const getSettingsNavCrumbs = (activeNav: ActiveSettingsNav | null): MessageDescriptor[] => {
  if (!activeNav) {
    return [];
  }

  const parent = findSettingsNavParent(activeNav.group.items, activeNav.item);

  return parent ? [parent.label, activeNav.item.label] : [activeNav.item.label];
};
