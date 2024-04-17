import { DocumentDataType, Role } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { hashSync } from '@documenso/lib/server-only/auth/hash';

import { prisma } from './index';

const seedDatabase = async () => {
  const examplePdf = fs
    .readFileSync(path.join(__dirname, '../../assets/example.pdf'))
    .toString('base64');

  const exampleUser = await prisma.user.upsert({
    where: {
      email: 'example@documenso.com',
    },
    create: {
      name: 'Example User',
      email: 'example@documenso.com',
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
      password: hashSync('password'),
      roles: [Role.USER, Role.ADMIN],
    },
    update: {},
  });

  const examplePdfData = await prisma.documentData.upsert({
    where: {
      id: 'clmn0kv5k0000pe04vcqg5zla',
    },
    create: {
      id: 'clmn0kv5k0000pe04vcqg5zla',
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
    update: {},
  });

  await prisma.document.upsert({
    where: {
      id: 1,
    },
    create: {
      id: 1,
      title: 'Example Document',
      documentDataId: examplePdfData.id,
      userId: exampleUser.id,
      Recipient: {
        create: {
          name: String(adminUser.name),
          email: adminUser.email,
          token: Math.random().toString(36).slice(2, 9),
        },
      },
    },
    update: {},
  });
};

seedDatabase()
  .then(() => {
    console.log('Database seeded');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
