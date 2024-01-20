import fs from 'node:fs';
import path from 'node:path';

import { hashSync } from '@documenso/lib/server-only/auth/hash';

import { prisma } from '..';
import { DocumentDataType, Role } from '../client';

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

  await prisma.document.create({
    data: {
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
  });
};
