import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '..';
import type { Prisma, User } from '../client';
import { DocumentDataType, ReadStatus, RecipientRole, SendStatus, SigningStatus } from '../client';

const examplePdf = fs
  .readFileSync(path.join(__dirname, '../../../assets/example.pdf'))
  .toString('base64');

type SeedTemplateOptions = {
  title?: string;
  userId: number;
  teamId?: number;
};

type CreateTemplateOptions = {
  key?: string | number;
  createTemplateOptions?: Partial<Prisma.TemplateUncheckedCreateInput>;
};

export const seedBlankTemplate = async (owner: User, options: CreateTemplateOptions = {}) => {
  const { key, createTemplateOptions = {} } = options;

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  return await prisma.template.create({
    data: {
      title: `[TEST] Template ${key}`,
      templateDocumentDataId: documentData.id,
      userId: owner.id,
      ...createTemplateOptions,
    },
  });
};

export const seedTemplate = async (options: SeedTemplateOptions) => {
  const { title = 'Untitled', userId, teamId } = options;

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  return await prisma.template.create({
    data: {
      title,
      templateDocumentData: {
        connect: {
          id: documentData.id,
        },
      },
      User: {
        connect: {
          id: userId,
        },
      },
      Recipient: {
        create: {
          email: 'recipient.1@documenso.com',
          name: 'Recipient 1',
          token: Math.random().toString().slice(2, 7),
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
          readStatus: ReadStatus.NOT_OPENED,
          role: RecipientRole.SIGNER,
        },
      },
      ...(teamId
        ? {
            team: {
              connect: {
                id: teamId,
              },
            },
          }
        : {}),
    },
  });
};
