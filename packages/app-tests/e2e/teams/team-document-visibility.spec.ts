import { test } from '@playwright/test';

import { DocumentStatus, TeamMemberRole } from '@documenso/prisma/client';
import { seedDocuments } from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[TEAMS]: test document access for first team member', async ({ page }) => {
  const team = await seedTeam();

  const adminUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
  const managerUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });
  const memberUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });
  const second_adminUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
  const second_managerUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MANAGER,
  });
  const second_memberUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await seedDocuments([
    {
      sender: memberUser,
      recipients: [],
      type: DocumentStatus.PENDING,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Document 1 - access',
      },
    },
    {
      sender: memberUser,
      recipients: [],
      type: DocumentStatus.PENDING,
      documentOptions: {
        teamId: team.id,
        visibility: 'MANAGER_AND_ABOVE',
        title: 'Document 2 - access',
      },
    },
    {
      sender: memberUser,
      recipients: [],
      type: DocumentStatus.DRAFT,
      documentOptions: {
        teamId: team.id,
        visibility: 'EVERYONE',
        title: 'Document 3 - access',
      },
    },
    {
      sender: second_memberUser,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'EVERYONE',
        title: 'Document 4 - access',
      },
    },
    {
      sender: second_memberUser,
      recipients: [],
      type: DocumentStatus.PENDING,
      documentOptions: {
        teamId: team.id,
        visibility: 'MANAGER_AND_ABOVE',
        title: 'Document 5 - no access',
      },
    },
    {
      sender: managerUser,
      recipients: [],
      type: DocumentStatus.DRAFT,
      documentOptions: {
        teamId: team.id,
        visibility: 'MANAGER_AND_ABOVE',
        title: 'Document 6 - no access',
      },
    },
    {
      sender: adminUser,
      recipients: [],
      type: DocumentStatus.DRAFT,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Document 7 - no access',
      },
    },
    {
      sender: adminUser,
      recipients: [memberUser],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Document 8 - access',
      },
    },
    {
      sender: second_adminUser,
      recipients: [memberUser, second_memberUser],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Document 9 - access',
      },
    },
    {
      sender: second_managerUser,
      recipients: [],
      type: DocumentStatus.PENDING,
      documentOptions: {
        teamId: team.id,
        visibility: 'EVERYONE',
        title: 'Document 10 - access',
      },
    },
  ]);

  await apiSignin({
    page,
    email: memberUser.email,
    password: 'password',
    redirectPath: `/t/${team.url}/documents`,
  });
});
