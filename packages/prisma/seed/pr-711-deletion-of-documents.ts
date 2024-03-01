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

const PULL_REQUEST_NUMBER = 711;
const EMAIL_DOMAIN = `pr-${PULL_REQUEST_NUMBER}.documenso.com`;

export const TEST_USERS = [
  {
    name: 'Sender 1',
    email: `sender1@${EMAIL_DOMAIN}`,
    password: 'Password123',
  },
  {
    name: 'Sender 2',
    email: `sender2@${EMAIL_DOMAIN}`,
    password: 'Password123',
  },
  {
    name: 'Sender 3',
    email: `sender3@${EMAIL_DOMAIN}`,
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

  const [user1, user2, user3] = users;

  await createDraftDocument(user1, [user2, user3]);
  await createPendingDocument(user1, [user2, user3]);
  await createCompletedDocument(user1, [user2, user3]);
};

const createDraftDocument = async (sender: User, recipients: User[]) => {
  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const document = await prisma.document.create({
    data: {
      title: `[${PULL_REQUEST_NUMBER}] Document 1 - Draft`,
      status: DocumentStatus.DRAFT,
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
        token: `draft-token-${index}`,
        readStatus: ReadStatus.NOT_OPENED,
        sendStatus: SendStatus.NOT_SENT,
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

const createPendingDocument = async (sender: User, recipients: User[]) => {
  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const document = await prisma.document.create({
    data: {
      title: `[${PULL_REQUEST_NUMBER}] Document 1 - Pending`,
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
        token: `pending-token-${index}`,
        readStatus: ReadStatus.OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.SIGNED,
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

const createCompletedDocument = async (sender: User, recipients: User[]) => {
  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const document = await prisma.document.create({
    data: {
      title: `[${PULL_REQUEST_NUMBER}] Document 1 - Completed`,
      status: DocumentStatus.COMPLETED,
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
        token: `completed-token-${index}`,
        readStatus: ReadStatus.OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.SIGNED,
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
