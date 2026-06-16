import { describe, expect, it } from 'vitest';

import { getVisibleFontOwners } from './font-access';

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
});
