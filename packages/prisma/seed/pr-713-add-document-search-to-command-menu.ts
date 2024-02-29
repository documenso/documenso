import type { User } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { hashSync } from '@documenso/lib/server-only/auth/hash';

import { prisma } from '..';
import {
  DocumentDataType,
  DocumentStatus,
  FieldType,
  Prisma,
  ReadStatus,
  SendStatus,
  SigningStatus,
} from '../client';

//
// https://github.com/documenso/documenso/pull/713
//

const PULL_REQUEST_NUMBER = 713;

const EMAIL_DOMAIN = `pr-${PULL_REQUEST_NUMBER}.documenso.com`;

export const TEST_USERS = [
  {
    name: 'User 1',
    email: `user1@${EMAIL_DOMAIN}`,
    password: 'Password123',
  },
  {
    name: 'User 2',
    email: `user2@${EMAIL_DOMAIN}`,
    password: 'Password123',
  },
] as const;

const examplePdf = fs
  .readFileSync(path.join(__dirname, '../../../assets/example.pdf'))
  .toString('base64');

export const seedDatabase = async () => {
  const users = await Promise.all(
    TEST_USERS.map(async (u) =>
      prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hashSync(u.password),
          emailVerified: new Date(),
          url: u.email,
        },
      }),
    ),
  );

  const [user1, user2] = users;

  await createSentDocument(user1, [user2]);
  await createReceivedDocument(user2, [user1]);
};

const createSentDocument = async (sender: User, recipients: User[]) => {
  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const document = await prisma.document.create({
    data: {
      title: `[${PULL_REQUEST_NUMBER}] Document - Sent`,
      status: DocumentStatus.PENDING,
      documentDataId: documentData.id,
      userId: sender.id,
    },
  });

  for (const recipient of recipients) {
    const index = recipients.indexOf(recipient);

    await prisma.recipient.create({
      data: {
        email: String(recipient.email),
        name: String(recipient.name),
        token: `sent-token-${index}`,
        readStatus: ReadStatus.NOT_OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.NOT_SIGNED,
        signedAt: new Date(),
        Document: {
          connect: {
            id: document.id,
          },
        },
        Field: {
          create: {
            page: 1,
            type: FieldType.NAME,
            inserted: true,
            customText: String(recipient.name),
            positionX: new Prisma.Decimal(1),
            positionY: new Prisma.Decimal(1),
            width: new Prisma.Decimal(1),
            height: new Prisma.Decimal(1),
            documentId: document.id,
          },
        },
      },
    });
  }
};

const createReceivedDocument = async (sender: User, recipients: User[]) => {
  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const document = await prisma.document.create({
    data: {
      title: `[${PULL_REQUEST_NUMBER}] Document - Received`,
      status: DocumentStatus.PENDING,
      documentDataId: documentData.id,
      userId: sender.id,
    },
  });

  for (const recipient of recipients) {
    const index = recipients.indexOf(recipient);

    await prisma.recipient.create({
      data: {
        email: String(recipient.email),
        name: String(recipient.name),
        token: `received-token-${index}`,
        readStatus: ReadStatus.NOT_OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.NOT_SIGNED,
        signedAt: new Date(),
        Document: {
          connect: {
            id: document.id,
          },
        },
        Field: {
          create: {
            page: 1,
            type: FieldType.NAME,
            inserted: true,
            customText: String(recipient.name),
            positionX: new Prisma.Decimal(1),
            positionY: new Prisma.Decimal(1),
            width: new Prisma.Decimal(1),
            height: new Prisma.Decimal(1),
            documentId: document.id,
          },
        },
      },
    });
  }
};
