import fs from 'node:fs';
import path from 'node:path';

import { formatAlignmentTestFields } from '@documenso/app-tests/constants/field-alignment-pdf';
import { FIELD_META_TEST_FIELDS } from '@documenso/app-tests/constants/field-meta-pdf';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import { incrementDocumentId } from '@documenso/lib/server-only/envelope/increment-id';
import { nanoid, prefixedId } from '@documenso/lib/universal/id';

import { prisma } from '..';
import {
  DocumentDataType,
  DocumentSource,
  DocumentStatus,
  EnvelopeType,
  ReadStatus,
  SendStatus,
  SigningStatus,
} from '../client';
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

    const documentId = await incrementDocumentId();

    const documentMeta = await prisma.documentMeta.create({
      data: {},
    });

    await prisma.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId: documentId.formattedDocumentId,
        internalVersion: 1,
        type: EnvelopeType.DOCUMENT,
        documentMetaId: documentMeta.id,
        source: DocumentSource.DOCUMENT,
        title: `Example Document ${i}`,
        envelopeItems: {
          create: {
            id: prefixedId('envelope_item'),
            title: `Example Document ${i}`,
            documentDataId: documentData.id,
            order: 1,
          },
        },
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

    const documentId = await incrementDocumentId();

    const documentMeta = await prisma.documentMeta.create({
      data: {},
    });

    await prisma.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId: documentId.formattedDocumentId,
        internalVersion: 1,
        type: EnvelopeType.DOCUMENT,
        source: DocumentSource.DOCUMENT,
        title: `Document ${i}`,
        documentMetaId: documentMeta.id,
        envelopeItems: {
          create: {
            id: prefixedId('envelope_item'),
            title: `Document ${i}`,
            documentDataId: documentData.id,
            order: 1,
          },
        },
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
    seedAlignmentTestDocument({
      userId: exampleUser.user.id,
      teamId: exampleUser.team.id,
      recipientName: exampleUser.user.name || '',
      recipientEmail: exampleUser.user.email,
      insertFields: false,
      status: DocumentStatus.DRAFT,
    }),
    seedAlignmentTestDocument({
      userId: exampleUser.user.id,
      teamId: exampleUser.team.id,
      recipientName: exampleUser.user.name || '',
      recipientEmail: exampleUser.user.email,
      insertFields: true,
      status: DocumentStatus.PENDING,
    }),
    seedAlignmentTestDocument({
      userId: adminUser.user.id,
      teamId: adminUser.team.id,
      recipientName: adminUser.user.name || '',
      recipientEmail: adminUser.user.email,
      insertFields: false,
      status: DocumentStatus.DRAFT,
    }),
    seedAlignmentTestDocument({
      userId: adminUser.user.id,
      teamId: adminUser.team.id,
      recipientName: adminUser.user.name || '',
      recipientEmail: adminUser.user.email,
      insertFields: true,
      status: DocumentStatus.PENDING,
    }),
  ]);
};

export const seedAlignmentTestDocument = async ({
  userId,
  teamId,
  recipientName,
  recipientEmail,
  insertFields,
  status,
}: {
  userId: number;
  teamId: number;
  recipientName: string;
  recipientEmail: string;
  insertFields: boolean;
  status: DocumentStatus;
}) => {
  const alignmentPdf = fs
    .readFileSync(path.join(__dirname, '../../../assets/field-font-alignment.pdf'))
    .toString('base64');

  const fieldMetaPdf = fs
    .readFileSync(path.join(__dirname, '../../../assets/field-meta.pdf'))
    .toString('base64');

  const alignmentDocumentData = await createDocumentData({ documentData: alignmentPdf });
  const fieldMetaDocumentData = await createDocumentData({ documentData: fieldMetaPdf });

  const documentId = await incrementDocumentId();

  const documentMeta = await prisma.documentMeta.create({
    data: {},
  });

  const createdEnvelope = await prisma.envelope.create({
    data: {
      id: prefixedId('envelope'),
      secondaryId: documentId.formattedDocumentId,
      internalVersion: 2,
      type: EnvelopeType.DOCUMENT,
      documentMetaId: documentMeta.id,
      source: DocumentSource.DOCUMENT,
      title: `Envelope Full Field Test`,
      status,
      envelopeItems: {
        createMany: {
          data: [
            {
              id: prefixedId('envelope_item'),
              title: `alignment-pdf`,
              documentDataId: alignmentDocumentData.id,
              order: 1,
            },
            {
              id: prefixedId('envelope_item'),
              title: `field-meta-pdf`,
              documentDataId: fieldMetaDocumentData.id,
              order: 2,
            },
          ],
        },
      },
      userId,
      teamId,
      recipients: {
        create: {
          name: recipientName,
          email: recipientEmail,
          token: nanoid(),
          sendStatus: status === 'DRAFT' ? SendStatus.NOT_SENT : SendStatus.SENT,
          signingStatus: status === 'COMPLETED' ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
          readStatus: status !== 'DRAFT' ? ReadStatus.OPENED : ReadStatus.NOT_OPENED,
        },
      },
    },
    include: {
      recipients: true,
      envelopeItems: true,
    },
  });

  const { id, recipients, envelopeItems } = createdEnvelope;

  const recipientId = recipients[0].id;
  const envelopeItemAlignmentItem = envelopeItems.find((item) => item.order === 1)?.id;
  const envelopeItemFieldMetaItem = envelopeItems.find((item) => item.order === 2)?.id;

  if (!envelopeItemAlignmentItem || !envelopeItemFieldMetaItem) {
    throw new Error('Envelope item not found');
  }

  await Promise.all(
    formatAlignmentTestFields.map(async (field) => {
      await prisma.field.create({
        data: {
          ...field,
          recipientId,
          envelopeItemId: envelopeItemAlignmentItem,
          envelopeId: id,
          customText: insertFields ? field.customText : '',
          inserted: insertFields,
          signature: field.signature
            ? {
                create: {
                  recipientId,
                  signatureImageAsBase64: isBase64Image(field.signature) ? field.signature : null,
                  typedSignature: isBase64Image(field.signature) ? null : field.signature,
                },
              }
            : undefined,
        },
      });
    }),
  );

  await Promise.all(
    FIELD_META_TEST_FIELDS.map(async (field) => {
      await prisma.field.create({
        data: {
          ...field,
          recipientId,
          envelopeItemId: envelopeItemFieldMetaItem,
          envelopeId: id,
          customText: insertFields ? field.customText : '',
          inserted: insertFields,
          signature: field.signature
            ? {
                create: {
                  recipientId,
                  signatureImageAsBase64: isBase64Image(field.signature) ? field.signature : null,
                  typedSignature: isBase64Image(field.signature) ? null : field.signature,
                },
              }
            : undefined,
        },
      });
    }),
  );

  return await prisma.envelope.findFirstOrThrow({
    where: {
      id: createdEnvelope.id,
    },
    include: {
      recipients: true,
      envelopeItems: true,
    },
  });
};
