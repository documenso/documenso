import { msg } from '@lingui/core/macro';
import { OrganisationMemberRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  findActiveSettingsNav,
  findActiveSettingsNavItem,
  getAdminNavGroups,
  getSettingsNavCrumbs,
  getSettingsNavGroups,
  type SettingsNavGroup,
  type SettingsNavItem,
} from './settings-nav';

describe('findActiveSettingsNavItem', () => {
  const adminItems = getAdminNavGroups().flatMap((group) => group.items);

  it('matches sub-routes and extra paths of an item but not paths that only share its prefix', () => {
    expect(findActiveSettingsNavItem(adminItems, '/admin/users/42')?.key).toBe('users');
    expect(findActiveSettingsNavItem(adminItems, '/admin/teams/7')?.key).toBe('organisations');
    expect(findActiveSettingsNavItem(adminItems, '/admin/usersettings')).toBeNull();
  });
});

describe('getSettingsNavCrumbs', () => {
  const getCrumbMessages = (groups: SettingsNavGroup[], pathname: string) =>
    getSettingsNavCrumbs(findActiveSettingsNav(groups, pathname)).map((crumb) => crumb.message);

  it('prefixes sub-nav pages with their parent, which shares its first child path', () => {
    const { organisation } = getSettingsNavGroups({
      organisation: {
        url: 'acme',
        currentOrganisationRole: OrganisationMemberRole.ADMIN,
        organisationClaim: {
          flags: {},
        },
      },
      team: null,
      hasManageableBillingOrgs: false,
    });

    const groups = organisation ? [organisation] : [];

    expect(getCrumbMessages(groups, '/o/acme/settings/branding')).toEqual(['Preferences', 'Branding']);
    expect(getCrumbMessages(groups, '/o/acme/settings/document')).toEqual(['Preferences', 'General']);
    expect(getCrumbMessages(groups, '/o/acme/settings/members')).toEqual(['Members']);
  });

  it('uses the nearest parent when a list has several sub-nav sections', () => {
    const items: SettingsNavItem[] = [
      { key: 'first', path: '/first', label: msg`First`, isSubNavParent: true },
      { key: 'first-child', path: '/first', label: msg`First child`, isSubNav: true },
      { key: 'flat', path: '/flat', label: msg`Flat` },
      { key: 'second', path: '/second', label: msg`Second`, isSubNavParent: true },
      { key: 'second-child', path: '/second', label: msg`Second child`, isSubNav: true },
    ];

    expect(getCrumbMessages([{ scope: 'admin', items }], '/second')).toEqual(['Second', 'Second child']);
  });
});
