import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '..';
import { DocumentDataType, DocumentSource } from '../client';
import { seedPendingDocument } from './documents';
import { seedDirectTemplate, seedTemplate } from './templates';
import { seedUser } from './users';

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

  const exampleUserExists = await prisma.user.findFirst({
    where: {
      email: 'example@documenso.com',
    },
  });

  const adminUserExists = await prisma.user.findFirst({
    where: {
      email: 'admin@documenso.com',
    },
  });

  if (exampleUserExists || adminUserExists) {
    return;
  }

  const exampleUser = await seedUser({
    name: 'Example User',
    email: 'example@documenso.com',
  });

  const adminUser = await seedUser({
    name: 'Admin User',
    email: 'admin@documenso.com',
    isAdmin: true,
  });

  for (let i = 1; i <= 4; i++) {
    const documentData = await createDocumentData({ documentData: examplePdf });

    await prisma.document.create({
      data: {
        source: DocumentSource.DOCUMENT,
        title: `Example Document ${i}`,
        documentDataId: documentData.id,
        userId: exampleUser.user.id,
        teamId: exampleUser.team.id,
        recipients: {
          create: {
            name: String(adminUser.user.name),
            email: adminUser.user.email,
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
        userId: adminUser.user.id,
        teamId: adminUser.team.id,
        recipients: {
          create: {
            name: String(exampleUser.user.name),
            email: exampleUser.user.email,
            token: Math.random().toString(36).slice(2, 9),
          },
        },
      },
    });
  }

  await seedPendingDocument(exampleUser.user, exampleUser.team.id, [adminUser.user], {
    key: 'example-pending',
    createDocumentOptions: {
      title: 'Pending Document',
    },
  });

  await seedPendingDocument(adminUser.user, adminUser.team.id, [exampleUser.user], {
    key: 'admin-pending',
    createDocumentOptions: {
      title: 'Pending Document',
    },
  });

  await Promise.all([
    seedTemplate({
      title: 'Template 1',
      userId: exampleUser.user.id,
      teamId: exampleUser.team.id,
    }),
    seedDirectTemplate({
      title: 'Direct Template 1',
      userId: exampleUser.user.id,
      teamId: exampleUser.team.id,
    }),

    seedTemplate({
      title: 'Template 1',
      userId: adminUser.user.id,
      teamId: adminUser.team.id,
    }),
    seedDirectTemplate({
      title: 'Direct Template 1',
      userId: adminUser.user.id,
      teamId: adminUser.team.id,
    }),
  ]);
};
