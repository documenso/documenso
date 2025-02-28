import fs from 'node:fs';
import path from 'node:path';

import { hashSync } from '@documenso/lib/server-only/auth/hash';

import { prisma } from '..';
import { DocumentDataType, DocumentSource, Role, TeamMemberRole } from '../client';
import { seedPendingDocument } from './documents';
import { seedDirectTemplate, seedTemplate } from './templates';

const createDocumentData = async ({ documentData }: { documentData: string }) => {
  return prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: documentData,
      initialData: documentData,
    },
  });
};

export const seedDatabase = async () => {
  const examplePdf = fs
    .readFileSync(path.join(__dirname, '../../../assets/example.pdf'))
    .toString('base64');

  const exampleUser = await prisma.user.upsert({
    where: {
      email: 'example@documenso.com',
    },
    create: {
      name: 'Example User',
      email: 'example@documenso.com',
      emailVerified: new Date(),
      password: hashSync('password'),
      roles: [Role.USER],
    },
    update: {},
  });

  const adminUser = await prisma.user.upsert({
    where: {
      email: 'admin@documenso.com',
    },
    create: {
      name: 'Admin User',
      email: 'admin@documenso.com',
      emailVerified: new Date(),
      password: hashSync('password'),
      roles: [Role.USER, Role.ADMIN],
    },
    update: {},
  });

  for (let i = 1; i <= 4; i++) {
    const documentData = await createDocumentData({ documentData: examplePdf });

    await prisma.document.create({
      data: {
        source: DocumentSource.DOCUMENT,
        title: `Example Document ${i}`,
        documentDataId: documentData.id,
        userId: exampleUser.id,
        recipients: {
          create: {
            name: String(adminUser.name),
            email: adminUser.email,
            token: Math.random().toString(36).slice(2, 9),
          },
        },
      },
    });
  }

  for (let i = 1; i <= 4; i++) {
    const documentData = await createDocumentData({ documentData: examplePdf });

    await prisma.document.create({
      data: {
        source: DocumentSource.DOCUMENT,
        title: `Document ${i}`,
        documentDataId: documentData.id,
        userId: adminUser.id,
        recipients: {
          create: {
            name: String(exampleUser.name),
            email: exampleUser.email,
            token: Math.random().toString(36).slice(2, 9),
          },
        },
      },
    });
  }

  await seedPendingDocument(exampleUser, [adminUser], {
    key: 'example-pending',
    createDocumentOptions: {
      title: 'Pending Document',
    },
  });

  await seedPendingDocument(adminUser, [exampleUser], {
    key: 'admin-pending',
    createDocumentOptions: {
      title: 'Pending Document',
    },
  });

  await Promise.all([
    seedTemplate({
      title: 'Template 1',
      userId: exampleUser.id,
    }),
    seedDirectTemplate({
      title: 'Direct Template 1',
      userId: exampleUser.id,
    }),

    seedTemplate({
      title: 'Template 1',
      userId: adminUser.id,
    }),
    seedDirectTemplate({
      title: 'Direct Template 1',
      userId: adminUser.id,
    }),
  ]);

  const testUsers = [
    'test@documenso.com',
    'test2@documenso.com',
    'test3@documenso.com',
    'test4@documenso.com',
  ];

  const createdUsers = [];

  for (const email of testUsers) {
    const testUser = await prisma.user.upsert({
      where: {
        email: email,
      },
      create: {
        name: 'Test User',
        email: email,
        emailVerified: new Date(),
        password: hashSync('password'),
        roles: [Role.USER],
      },
      update: {},
    });

    createdUsers.push(testUser);
  }

  const team1 = await prisma.team.create({
    data: {
      name: 'Team 1',
      url: 'team1',
      ownerUserId: createdUsers[0].id,
    },
  });

  const team2 = await prisma.team.create({
    data: {
      name: 'Team 2',
      url: 'team2',
      ownerUserId: createdUsers[1].id,
    },
  });

  for (const team of [team1, team2]) {
    await prisma.teamMember.createMany({
      data: [
        {
          teamId: team.id,
          userId: createdUsers[1].id,
          role: TeamMemberRole.ADMIN,
        },
        {
          teamId: team.id,
          userId: createdUsers[2].id,
          role: TeamMemberRole.MEMBER,
        },
      ],
    });
  }
};
