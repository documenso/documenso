import fs from 'node:fs';
import path from 'node:path';

import {
  DIRECT_TEMPLATE_RECIPIENT_EMAIL,
  DIRECT_TEMPLATE_RECIPIENT_NAME,
} from '@documenso/lib/constants/direct-templates';

import { prisma } from '..';
import type { Prisma, User } from '../client';
import { DocumentDataType, ReadStatus, RecipientRole, SendStatus, SigningStatus } from '../client';

const examplePdf = fs
  .readFileSync(path.join(__dirname, '../../../assets/example.pdf'))
  .toString('base64');

type SeedTemplateOptions = {
  title?: string;
  userId: number;
  teamId: number;
  createTemplateOptions?: Partial<Prisma.TemplateCreateInput>;
};

type CreateTemplateOptions = {
  key?: string | number;
  createTemplateOptions?: Partial<Prisma.TemplateUncheckedCreateInput>;
};

export const seedBlankTemplate = async (
  owner: User,
  teamId: number,
  options: CreateTemplateOptions = {},
) => {
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
      teamId,
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
      user: {
        connect: {
          id: userId,
        },
      },
      recipients: {
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
      team: {
        connect: {
          id: teamId,
        },
      },
    },
  });
};

export const seedDirectTemplate = async (options: SeedTemplateOptions) => {
  const { title = 'Untitled', userId, teamId } = options;

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const template = await prisma.template.create({
    data: {
      title,
      templateDocumentData: {
        connect: {
          id: documentData.id,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
      recipients: {
        create: {
          email: DIRECT_TEMPLATE_RECIPIENT_EMAIL,
          name: DIRECT_TEMPLATE_RECIPIENT_NAME,
          token: Math.random().toString().slice(2, 7),
        },
      },
      team: {
        connect: {
          id: teamId,
        },
      },
      ...options.createTemplateOptions,
    },
    include: {
      recipients: true,
      user: true,
    },
  });

  const directTemplateRecpient = template.recipients.find(
    (recipient) => recipient.email === DIRECT_TEMPLATE_RECIPIENT_EMAIL,
  );

  if (!directTemplateRecpient) {
    throw new Error('Need to create a direct template recipient');
  }

  await prisma.templateDirectLink.create({
    data: {
      templateId: template.id,
      enabled: true,
      token: Math.random().toString(),
      directTemplateRecipientId: directTemplateRecpient.id,
    },
  });

  return await prisma.template.findFirstOrThrow({
    where: {
      id: template.id,
    },
    include: {
      directLink: true,
      fields: true,
      recipients: true,
      team: true,
    },
  });
};
