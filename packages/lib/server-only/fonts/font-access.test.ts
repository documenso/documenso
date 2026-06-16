import { describe, expect, it } from 'vitest';

import { getVisibleFontOwners } from './font-access';
import { isFontAssetVisibleToContext } from './font-assets';

describe('getVisibleFontOwners', () => {
  it('limits personal font libraries to the current user', () => {
    expect(
      getVisibleFontOwners({
        type: 'personal',
        userId: 12,
      }),
    ).toEqual([{ userId: 12 }]);
  });

  it('includes personal and organisation fonts when viewing a team font library', () => {
    expect(
      getVisibleFontOwners({
        type: 'team',
        userId: 12,
        teamId: 34,
        organisationId: 'org_56',
      }),
    ).toEqual([{ userId: 12 }, { teamId: 34 }, { organisationId: 'org_56' }]);
  });

  it('limits organisation font libraries to the organisation', () => {
    expect(
      getVisibleFontOwners({
        type: 'organisation',
        organisationId: 'org_56',
      }),
    ).toEqual([{ organisationId: 'org_56' }]);
  });

  it('checks whether a font asset belongs to a visible owner', () => {
    const context = {
      type: 'team' as const,
      userId: 12,
      teamId: 34,
      organisationId: 'org_56',
    };

    expect(isFontAssetVisibleToContext({ userId: 12, teamId: null, organisationId: null }, context)).toBe(true);
    expect(isFontAssetVisibleToContext({ userId: null, teamId: 34, organisationId: null }, context)).toBe(true);
    expect(isFontAssetVisibleToContext({ userId: null, teamId: null, organisationId: 'org_56' }, context)).toBe(true);
    expect(isFontAssetVisibleToContext({ userId: 99, teamId: null, organisationId: null }, context)).toBe(false);
  });
});
