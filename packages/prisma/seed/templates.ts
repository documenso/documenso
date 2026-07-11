import fs from 'node:fs';
import path from 'node:path';

import {
  DIRECT_TEMPLATE_RECIPIENT_EMAIL,
  DIRECT_TEMPLATE_RECIPIENT_NAME,
} from '@documenso/lib/constants/direct-templates';
import { incrementTemplateId } from '@documenso/lib/server-only/envelope/increment-id';
import { FIELD_SIGNATURE_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import { SignatureLevel } from '@documenso/lib/types/signature-level';
import { prefixedId } from '@documenso/lib/universal/id';

import { prisma } from '..';
import type { Prisma, User } from '../client';
import {
  DocumentDataType,
  DocumentSource,
  EnvelopeType,
  FieldType,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '../client';

const examplePdf = fs.readFileSync(path.join(__dirname, '../../../assets/example.pdf')).toString('base64');

type SeedTemplateOptions = {
  title?: string;
  userId: number;
  teamId: number;
  internalVersion?: 1 | 2;
  createTemplateOptions?: Partial<Prisma.EnvelopeUncheckedCreateInput>;
  /**
   * Only used by seedDirectTemplate. Creates a signature field for the direct
   * recipient so the seeded direct template is valid. Defaults to true.
   */
  createDirectRecipientSignatureField?: boolean;
};

type CreateTemplateOptions = {
  key?: string | number;
  createTemplateOptions?: Partial<Prisma.EnvelopeUncheckedCreateInput>;
};

export const seedBlankTemplate = async (owner: User, teamId: number, options: CreateTemplateOptions = {}) => {
  const { key, createTemplateOptions = {} } = options;

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  const templateId = await incrementTemplateId();

  const documentMeta = await prisma.documentMeta.create({
    data: {},
  });

  return await prisma.envelope.create({
    data: {
      id: prefixedId('envelope'),
      secondaryId: templateId.formattedTemplateId,
      internalVersion: 1,
      signatureLevel: SignatureLevel.SES,
      type: EnvelopeType.TEMPLATE,
      title: `[TEST] Template ${key}`,
      teamId,
      envelopeItems: {
        create: {
          id: prefixedId('envelope_item'),
          title: `[TEST] Template ${key}`,
          documentDataId: documentData.id,
          order: 1,
        },
      },
      userId: owner.id,
      source: DocumentSource.TEMPLATE,
      documentMetaId: documentMeta.id,
      ...createTemplateOptions,
    },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
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

  const templateId = await incrementTemplateId();

  const documentMeta = await prisma.documentMeta.create({
    data: {},
  });

  return await prisma.envelope.create({
    data: {
      id: prefixedId('envelope'),
      secondaryId: templateId.formattedTemplateId,
      internalVersion: options.internalVersion ?? 1,
      signatureLevel: SignatureLevel.SES,
      type: EnvelopeType.TEMPLATE,
      title,
      envelopeItems: {
        create: {
          id: prefixedId('envelope_item'),
          title,
          documentDataId: documentData.id,
          order: 1,
        },
      },
      source: DocumentSource.TEMPLATE,
      documentMetaId: documentMeta.id,
      userId,
      teamId,
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
    },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
      recipients: true,
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

  const templateId = await incrementTemplateId();

  const documentMeta = await prisma.documentMeta.create({
    data: {},
  });

  const template = await prisma.envelope.create({
    data: {
      id: prefixedId('envelope'),
      secondaryId: templateId.formattedTemplateId,
      internalVersion: options.internalVersion ?? 1,
      signatureLevel: SignatureLevel.SES,
      type: EnvelopeType.TEMPLATE,
      title,
      envelopeItems: {
        create: {
          id: prefixedId('envelope_item'),
          title,
          documentDataId: documentData.id,
          order: 1,
        },
      },
      source: DocumentSource.TEMPLATE,
      documentMetaId: documentMeta.id,
      userId,
      teamId,
      recipients: {
        create: {
          signingOrder: 1,
          email: DIRECT_TEMPLATE_RECIPIENT_EMAIL,
          name: DIRECT_TEMPLATE_RECIPIENT_NAME,
          token: Math.random().toString().slice(2, 7),
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
      envelopeId: template.id,
      enabled: true,
      token: Math.random().toString(),
      directTemplateRecipientId: directTemplateRecpient.id,
    },
  });

  const { createDirectRecipientSignatureField = true } = options;

  if (createDirectRecipientSignatureField) {
    const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
      where: { envelopeId: template.id },
    });

    await prisma.field.create({
      data: {
        envelopeId: template.id,
        envelopeItemId: envelopeItem.id,
        recipientId: directTemplateRecpient.id,
        type: FieldType.SIGNATURE,
        page: 1,
        positionX: 5,
        positionY: 10,
        width: 20,
        height: 5,
        customText: '',
        inserted: false,
        fieldMeta: FIELD_SIGNATURE_META_DEFAULT_VALUES,
      },
    });
  }

  return await prisma.envelope.findFirstOrThrow({
    where: {
      id: template.id,
    },
    include: {
      directLink: true,
      fields: true,
      recipients: true,
      team: true,
      envelopeItems: {
        select: {
          documentData: true,
        },
      },
    },
  });
};
