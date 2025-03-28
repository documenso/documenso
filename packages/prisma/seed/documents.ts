import type { Document, Team, User } from '@prisma/client';
import { nanoid } from 'nanoid';
import fs from 'node:fs';
import path from 'node:path';
import { match } from 'ts-pattern';

import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { createTemplate } from '@documenso/lib/server-only/template/create-template';

import { prisma } from '..';
import {
  DocumentDataType,
  DocumentSource,
  DocumentStatus,
  FieldType,
  Prisma,
  ReadStatus,
  SendStatus,
  SigningStatus,
} from '../client';
import { seedTeam } from './teams';
import { seedUser } from './users';

const examplePdf = fs
  .readFileSync(path.join(__dirname, '../../../assets/example.pdf'))
  .toString('base64');

type DocumentToSeed = {
  sender: User;
  recipients: (User | string)[];
  type: DocumentStatus;
  documentOptions?: Partial<Prisma.DocumentUncheckedCreateInput>;
};

export const seedDocuments = async (documents: DocumentToSeed[]) => {
  await Promise.all(
    // eslint-disable-next-line @typescript-eslint/require-await
    documents.map(async (document, i) =>
      match(document.type)
        .with(DocumentStatus.DRAFT, async () =>
          seedDraftDocument(document.sender, document.recipients, {
            key: i,
            createDocumentOptions: document.documentOptions,
          }),
        )
        .with(DocumentStatus.PENDING, async () =>
          seedPendingDocument(document.sender, document.recipients, {
            key: i,
            createDocumentOptions: document.documentOptions,
          }),
        )
        .with(DocumentStatus.COMPLETED, async () =>
          seedCompletedDocument(document.sender, document.recipients, {
            key: i,
            createDocumentOptions: document.documentOptions,
          }),
        ),
    ),
  );
};

export const seedBlankDocument = async (owner: User, options: CreateDocumentOptions = {}) => {
  const { key, createDocumentOptions = {} } = options;

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  return await prisma.document.create({
    data: {
      source: DocumentSource.DOCUMENT,
      title: `[TEST] Document ${key} - Draft`,
      status: DocumentStatus.DRAFT,
      documentDataId: documentData.id,
      userId: owner.id,
      ...createDocumentOptions,
    },
  });
};

export const unseedDocument = async (documentId: number) => {
  await prisma.document.delete({
    where: {
      id: documentId,
    },
  });
};

export const seedTeamDocumentWithMeta = async (team: Team) => {
  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const document = await createDocument({
    userId: team.ownerUserId,
    teamId: team.id,
    title: `[TEST] Document ${nanoid(8)} - Draft`,
    documentDataId: documentData.id,
    normalizePdf: true,
    requestMetadata: {
      auth: null,
      requestMetadata: {},
      source: 'app',
    },
  });

  const owner = await prisma.user.findFirstOrThrow({
    where: {
      id: team.ownerUserId,
    },
  });

  await prisma.document.update({
    where: {
      id: document.id,
    },
    data: {
      status: DocumentStatus.PENDING,
    },
  });

  await prisma.recipient.create({
    data: {
      email: owner.email,
      name: owner.name ?? '',
      token: nanoid(),
      readStatus: ReadStatus.OPENED,
      sendStatus: SendStatus.SENT,
      signingStatus: SigningStatus.NOT_SIGNED,
      signedAt: new Date(),
      document: {
        connect: {
          id: document.id,
        },
      },
      fields: {
        create: {
          page: 1,
          type: FieldType.SIGNATURE,
          inserted: false,
          customText: '',
          positionX: new Prisma.Decimal(1),
          positionY: new Prisma.Decimal(1),
          width: new Prisma.Decimal(5),
          height: new Prisma.Decimal(5),
          documentId: document.id,
        },
      },
    },
  });

  return await prisma.document.findFirstOrThrow({
    where: {
      id: document.id,
    },
    include: {
      recipients: true,
    },
  });
};

export const seedTeamTemplateWithMeta = async (team: Team) => {
  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const template = await createTemplate({
    title: `[TEST] Template ${nanoid(8)} - Draft`,
    userId: team.ownerUserId,
    teamId: team.id,
    templateDocumentDataId: documentData.id,
  });

  const owner = await prisma.user.findFirstOrThrow({
    where: {
      id: team.ownerUserId,
    },
  });

  await prisma.recipient.create({
    data: {
      email: owner.email,
      name: owner.name ?? '',
      token: nanoid(),
      readStatus: ReadStatus.OPENED,
      sendStatus: SendStatus.SENT,
      signingStatus: SigningStatus.NOT_SIGNED,
      signedAt: new Date(),
      template: {
        connect: {
          id: template.id,
        },
      },
      fields: {
        create: {
          page: 1,
          type: FieldType.SIGNATURE,
          inserted: false,
          customText: '',
          positionX: new Prisma.Decimal(1),
          positionY: new Prisma.Decimal(1),
          width: new Prisma.Decimal(5),
          height: new Prisma.Decimal(5),
          templateId: template.id,
        },
      },
    },
  });

  return await prisma.document.findFirstOrThrow({
    where: {
      id: template.id,
    },
    include: {
      recipients: true,
    },
  });
};

export const seedDraftDocument = async (
  sender: User,
  recipients: (User | string)[],
  options: CreateDocumentOptions = {},
) => {
  const { key, createDocumentOptions = {} } = options;

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const document = await prisma.document.create({
    data: {
      source: DocumentSource.DOCUMENT,
      title: `[TEST] Document ${key} - Draft`,
      status: DocumentStatus.DRAFT,
      documentDataId: documentData.id,
      userId: sender.id,
      ...createDocumentOptions,
    },
  });

  for (const recipient of recipients) {
    const email = typeof recipient === 'string' ? recipient : recipient.email;
    const name = typeof recipient === 'string' ? recipient : (recipient.name ?? '');

    await prisma.recipient.create({
      data: {
        email,
        name,
        token: nanoid(),
        readStatus: ReadStatus.NOT_OPENED,
        sendStatus: SendStatus.NOT_SENT,
        signingStatus: SigningStatus.NOT_SIGNED,
        signedAt: new Date(),
        document: {
          connect: {
            id: document.id,
          },
        },
        fields: {
          create: {
            page: 1,
            type: FieldType.NAME,
            inserted: true,
            customText: name,
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

  return document;
};

type CreateDocumentOptions = {
  key?: string | number;
  createDocumentOptions?: Partial<Prisma.DocumentUncheckedCreateInput>;
};

export const seedPendingDocument = async (
  sender: User,
  recipients: (User | string)[],
  options: CreateDocumentOptions = {},
) => {
  const { key, createDocumentOptions = {} } = options;

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const document = await prisma.document.create({
    data: {
      source: DocumentSource.DOCUMENT,
      title: `[TEST] Document ${key} - Pending`,
      status: DocumentStatus.PENDING,
      documentDataId: documentData.id,
      userId: sender.id,
      ...createDocumentOptions,
    },
  });

  for (const recipient of recipients) {
    const email = typeof recipient === 'string' ? recipient : recipient.email;
    const name = typeof recipient === 'string' ? recipient : (recipient.name ?? '');

    await prisma.recipient.create({
      data: {
        email,
        name,
        token: nanoid(),
        readStatus: ReadStatus.OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.NOT_SIGNED,
        signedAt: new Date(),
        document: {
          connect: {
            id: document.id,
          },
        },
        fields: {
          create: {
            page: 1,
            type: FieldType.NAME,
            inserted: true,
            customText: name,
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

  return prisma.document.findFirstOrThrow({
    where: {
      id: document.id,
    },
    include: {
      recipients: true,
    },
  });
};

export const seedPendingDocumentNoFields = async ({
  owner,
  recipients,
  updateDocumentOptions,
}: {
  owner: User;
  recipients: (User | string)[];
  updateDocumentOptions?: Partial<Prisma.DocumentUncheckedUpdateInput>;
}) => {
  const document: Document = await seedBlankDocument(owner);

  for (const recipient of recipients) {
    const email = typeof recipient === 'string' ? recipient : recipient.email;
    const name = typeof recipient === 'string' ? recipient : (recipient.name ?? '');

    await prisma.recipient.create({
      data: {
        email,
        name,
        token: nanoid(),
        readStatus: ReadStatus.OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.NOT_SIGNED,
        signedAt: new Date(),
        document: {
          connect: {
            id: document.id,
          },
        },
      },
    });
  }

  const createdRecipients = await prisma.recipient.findMany({
    where: {
      documentId: document.id,
    },
    include: {
      fields: true,
    },
  });

  const latestDocument = updateDocumentOptions
    ? await prisma.document.update({
        where: {
          id: document.id,
        },
        data: updateDocumentOptions,
      })
    : document;

  return {
    document: latestDocument,
    recipients: createdRecipients,
  };
};

export const seedPendingDocumentWithFullFields = async ({
  owner,
  recipients,
  recipientsCreateOptions,
  updateDocumentOptions,
  fields = [FieldType.DATE, FieldType.EMAIL, FieldType.NAME, FieldType.SIGNATURE, FieldType.TEXT],
}: {
  owner: User;
  recipients: (User | string)[];
  recipientsCreateOptions?: Partial<Prisma.RecipientCreateInput>[];
  updateDocumentOptions?: Partial<Prisma.DocumentUncheckedUpdateInput>;
  fields?: FieldType[];
}) => {
  const document: Document = await seedBlankDocument(owner);

  for (const [recipientIndex, recipient] of recipients.entries()) {
    const email = typeof recipient === 'string' ? recipient : recipient.email;
    const name = typeof recipient === 'string' ? recipient : (recipient.name ?? '');

    await prisma.recipient.create({
      data: {
        email,
        name,
        token: nanoid(),
        readStatus: ReadStatus.OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.NOT_SIGNED,
        signedAt: new Date(),
        document: {
          connect: {
            id: document.id,
          },
        },
        fields: {
          createMany: {
            data: fields.map((fieldType, fieldIndex) => ({
              page: 1,
              type: fieldType,
              inserted: false,
              customText: name,
              positionX: new Prisma.Decimal((recipientIndex + 1) * 5),
              positionY: new Prisma.Decimal((fieldIndex + 1) * 5),
              width: new Prisma.Decimal(5),
              height: new Prisma.Decimal(5),
              documentId: document.id,
            })),
          },
        },
        ...(recipientsCreateOptions?.[recipientIndex] ?? {}),
      },
    });
  }

  const createdRecipients = await prisma.recipient.findMany({
    where: {
      documentId: document.id,
    },
    include: {
      fields: true,
    },
  });

  const latestDocument = await prisma.document.update({
    where: {
      id: document.id,
    },
    data: {
      ...updateDocumentOptions,
      status: DocumentStatus.PENDING,
    },
    include: {
      documentMeta: true,
    },
  });

  return {
    document: latestDocument,
    recipients: createdRecipients,
  };
};

export const seedCompletedDocument = async (
  sender: User,
  recipients: (User | string)[],
  options: CreateDocumentOptions = {},
) => {
  const { key, createDocumentOptions = {} } = options;

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const document = await prisma.document.create({
    data: {
      source: DocumentSource.DOCUMENT,
      title: `[TEST] Document ${key} - Completed`,
      status: DocumentStatus.COMPLETED,
      documentDataId: documentData.id,
      userId: sender.id,
      ...createDocumentOptions,
    },
  });

  for (const recipient of recipients) {
    const email = typeof recipient === 'string' ? recipient : recipient.email;
    const name = typeof recipient === 'string' ? recipient : (recipient.name ?? '');

    await prisma.recipient.create({
      data: {
        email,
        name,
        token: nanoid(),
        readStatus: ReadStatus.OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.SIGNED,
        signedAt: new Date(),
        document: {
          connect: {
            id: document.id,
          },
        },
        fields: {
          create: {
            page: 1,
            type: FieldType.NAME,
            inserted: true,
            customText: name,
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

  return document;
};

/**
 * Create 5 team documents:
 * - Completed document with 2 recipients.
 * - Pending document with 1 recipient.
 * - Pending document with 4 recipients.
 * - Draft document with 3 recipients.
 * - Draft document with 2 recipients.
 *
 * Create 3 non team documents where the user is a team member:
 * - Completed document with 2 recipients.
 * - Pending document with 1 recipient.
 * - Draft document with 2 recipients.
 *
 * Create 3 non team documents where the user is not a team member, but the recipient is:
 * - Completed document with 2 recipients.
 * - Pending document with 1 recipient.
 * - Draft document with 2 recipients.
 *
 * This should result in the following team document dashboard counts:
 * - 0 Inbox
 * - 2 Pending
 * - 1 Completed
 * - 2 Draft
 * - 5 All
 */
export const seedTeamDocuments = async () => {
  const team = await seedTeam({
    createTeamMembers: 4,
  });

  const documentOptions = {
    teamId: team.id,
  };

  const teamMember1 = team.members[1].user;
  const teamMember2 = team.members[2].user;
  const teamMember3 = team.members[3].user;
  const teamMember4 = team.members[4].user;

  const [testUser1, testUser2, testUser3, testUser4] = await Promise.all([
    seedUser(),
    seedUser(),
    seedUser(),
    seedUser(),
  ]);

  await seedDocuments([
    /**
     * Team documents.
     */
    {
      sender: teamMember1,
      recipients: [testUser1, testUser2],
      type: DocumentStatus.COMPLETED,
      documentOptions,
    },
    {
      sender: teamMember2,
      recipients: [testUser1],
      type: DocumentStatus.PENDING,
      documentOptions,
    },
    {
      sender: teamMember2,
      recipients: [testUser1, testUser2, testUser3, testUser4],
      type: DocumentStatus.PENDING,
      documentOptions,
    },
    {
      sender: teamMember2,
      recipients: [testUser1, testUser2, teamMember1],
      type: DocumentStatus.DRAFT,
      documentOptions,
    },
    {
      sender: team.owner,
      recipients: [testUser1, testUser2],
      type: DocumentStatus.DRAFT,
      documentOptions,
    },
    /**
     * Non team documents where the sender is a team member and recipient is not.
     */
    {
      sender: teamMember1,
      recipients: [testUser1, testUser2],
      type: DocumentStatus.COMPLETED,
    },
    {
      sender: teamMember2,
      recipients: [testUser1],
      type: DocumentStatus.PENDING,
    },
    {
      sender: teamMember3,
      recipients: [testUser1, testUser2],
      type: DocumentStatus.DRAFT,
    },
    /**
     * Non team documents where the sender is not a team member and recipient is.
     */
    {
      sender: testUser1,
      recipients: [teamMember1, teamMember2],
      type: DocumentStatus.COMPLETED,
    },
    {
      sender: testUser2,
      recipients: [teamMember1],
      type: DocumentStatus.PENDING,
    },
    {
      sender: testUser3,
      recipients: [teamMember1, teamMember2],
      type: DocumentStatus.DRAFT,
    },
  ]);

  return {
    team,
    teamMember1,
    teamMember2,
    teamMember3,
    teamMember4,
    testUser1,
    testUser2,
    testUser3,
    testUser4,
  };
};
