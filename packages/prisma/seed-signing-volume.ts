import type { Subscription, Team, User } from '@prisma/client';
import { DocumentDataType, PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { hashSync } from '@documenso/lib/server-only/auth/hash';

const prisma = new PrismaClient();

const examplePdf = fs
  .readFileSync(path.join(__dirname, '../../assets/example.pdf'))
  .toString('base64');

async function seedLeaderboardData(numUsers: number, numTeams: number) {
  const users: User[] = [];
  const teams: Team[] = [];
  const subscriptions: Subscription[] = [];

  // Create users with subscriptions
  for (let i = 0; i < numUsers; i++) {
    const user = await prisma.user.create({
      data: {
        name: `User ${i + 1}`,
        email: `user${i + 1}@documenso.com`,
        password: hashSync('password'),
        emailVerified: new Date(),
      },
    });
    users.push(user);

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        status: 'ACTIVE',
        planId: `plan_${Date.now().toString()}`,
        priceId: `price_${Date.now().toString()}`,
      },
    });
    subscriptions.push(subscription);
  }

  // Create teams
  for (let i = 0; i < numTeams; i++) {
    const ownerUser = users[Math.floor(Math.random() * users.length)];
    const team = await prisma.team.create({
      data: {
        name: `Team ${i + 1}`,
        url: `team-${Date.now().toString()}`,
        ownerUserId: ownerUser.id,
      },
    });
    teams.push(team);

    // Add random users to the team
    const teamMembers = users.filter((u) => u.id !== ownerUser.id).slice(0, 3);
    for (const member of teamMembers) {
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: member.id,
          role: 'MEMBER',
        },
      });
    }
  }

  // Create documents for each user
  for (const user of users) {
    const numDocuments = Math.floor(Math.random() * 10) + 1; // 1 to 5 documents per user
    for (let i = 0; i < numDocuments; i++) {
      const documentData = await prisma.documentData.create({
        data: {
          type: DocumentDataType.BYTES_64,
          data: examplePdf,
          initialData: examplePdf,
        },
      });

      await prisma.document.create({
        data: {
          title: `Personal Document ${i + 1} for User ${user.id}`,
          userId: user.id,
          status: 'COMPLETED',
          documentDataId: documentData.id,
          source: 'DOCUMENT',
        },
      });
    }
  }

  // Create documents for each team
  for (const team of teams) {
    const numDocuments = Math.floor(Math.random() * 10) + 1; // 1 to 10 documents per team
    for (let i = 0; i < numDocuments; i++) {
      const documentData = await prisma.documentData.create({
        data: {
          type: DocumentDataType.BYTES_64,
          data: 'base64encodeddata', // Replace with actual data if needed
          initialData: 'base64encodeddata', // Replace with actual data if needed
        },
      });

      await prisma.document.create({
        data: {
          title: `Team Document ${i + 1} for Team ${team.id}`,
          userId: team.ownerUserId, // Assign to team owner
          teamId: team.id,
          status: 'COMPLETED',
          documentDataId: documentData.id,
          source: 'DOCUMENT',
        },
      });
    }
  }

  console.log(`Seeded ${users.length} users, ${teams.length} teams, and their documents.`);
}

// Usage
seedLeaderboardData(50, 10)
  .catch((e) => console.error(e))
  .finally(() => {
    void prisma.$disconnect();
  });
