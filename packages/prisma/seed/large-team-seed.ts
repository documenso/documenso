import { createTeamMembers } from '@documenso/trpc/server/team-router/create-team-members';
import { TeamMemberRole } from '@prisma/client';

import { prisma } from '..';
import { seedTeam } from './teams';

/**
 * One-off seed script: creates a team with a large number of members.
 *
 * Run via:
 *   npm run with:env -- tsx packages/prisma/seed/large-team-seed.ts
 *
 * Produces:
 *   - 1 owner
 *   - ORG_MEMBER_COUNT organisation members
 *   - TEAM_MEMBER_COUNT of those org members are also added to the team's role group
 */

const ORG_MEMBER_COUNT = 200;
const TEAM_MEMBER_COUNT = 50;

const seedLargeTeam = async () => {
  console.log(`[SEEDING]: Creating team with ${ORG_MEMBER_COUNT} organisation members...`);

  const { owner, team, organisation } = await seedTeam({
    createTeamMembers: ORG_MEMBER_COUNT,
  });

  // Exclude the owner — they're already a team member by default.
  const nonOwnerOrgMembers = organisation.members.filter((member) => member.userId !== owner.id);

  const membersToAttachToTeam = nonOwnerOrgMembers.slice(0, TEAM_MEMBER_COUNT);

  console.log(`[SEEDING]: Attaching ${membersToAttachToTeam.length} org members to the team's role group...`);

  await createTeamMembers({
    userId: owner.id,
    teamId: team.id,
    membersToCreate: membersToAttachToTeam.map((member) => ({
      organisationMemberId: member.id,
      teamRole: TeamMemberRole.MEMBER,
    })),
  });

  console.log(`[SEEDING]: Done.`);
  console.log(`  Owner email:      ${owner.email}`);
  console.log(`  Owner password:   password`);
  console.log(`  Organisation:     ${organisation.url} (id ${organisation.id})`);
  console.log(`  Team URL:         ${team.url} (id ${team.id})`);
  console.log(`  Org members:      ${ORG_MEMBER_COUNT}`);
  console.log(`  Team-group members: ${membersToAttachToTeam.length}`);
};

const main = async () => {
  try {
    await seedLargeTeam();
  } catch (err) {
    console.error('[SEEDING]: Failed to seed large team.');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void main();
