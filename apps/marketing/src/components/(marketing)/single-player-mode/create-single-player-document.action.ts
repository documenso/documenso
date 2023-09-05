'use server';

import { createElement } from 'react';

import { DateTime } from 'luxon';
import { nanoid } from 'nanoid';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentSelfSignedEmailTemplate } from '@documenso/email/templates/document-self-signed';
import { SERVICE_USER_EMAIL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { insertFieldInPDF } from '@documenso/lib/server-only/pdf/insert-field-in-pdf';
import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  FieldType,
  Prisma,
  ReadStatus,
  SendStatus,
  SigningStatus,
} from '@documenso/prisma/client';

const ZCreateSinglePlayerDocumentSchema = z.object({
  document: z.string(),
  documentName: z.string(),
  signer: z.object({
    email: z.string().email().min(1),
    name: z.string(),
    signature: z.string(),
  }),
  fields: z.array(
    z.object({
      page: z.number(),
      type: z.nativeEnum(FieldType),
      positionX: z.number(),
      positionY: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  ),
});

export type TCreateSinglePlayerDocumentSchema = z.infer<typeof ZCreateSinglePlayerDocumentSchema>;

/**
 * Create and self signs a document.
 *
 * Returns the document token.
 */
export const createSinglePlayerDocument = async (
  value: TCreateSinglePlayerDocumentSchema,
): Promise<string> => {
  const { signer, fields, document, documentName } = ZCreateSinglePlayerDocumentSchema.parse(value);

  const doc = await PDFDocument.load(document);
  const createdAt = new Date();

  const isBase64 = signer.signature.startsWith('data:image/png;base64,');
  const signatureImageAsBase64 = isBase64 ? signer.signature : null;
  const typedSignature = !isBase64 ? signer.signature : null;

  // Update the document with the fields inserted.
  for (const field of fields) {
    const isSignatureField = field.type === FieldType.SIGNATURE;

    await insertFieldInPDF(doc, {
      ...mapFields(field, signer),
      Signature: isSignatureField
        ? {
            created: createdAt,
            signatureImageAsBase64,
            typedSignature,
            // Dummy data.
            id: -1,
            recipientId: -1,
            fieldId: -1,
          }
        : null,
      // Dummy data.
      id: -1,
      documentId: -1,
      recipientId: -1,
    });
  }

  const pdfBytes = await doc.save();

  const documentToken = await prisma.$transaction(async (tx) => {
    const documentToken = nanoid();

    // Fetch service user who will be the owner of the document.
    const serviceUser = await tx.user.findFirstOrThrow({
      where: {
        email: SERVICE_USER_EMAIL,
      },
    });

    // Create document and recipient.
    const document = await tx.document.create({
      data: {
        title: documentName,
        status: DocumentStatus.COMPLETED,
        userId: serviceUser.id,
        document: Buffer.from(pdfBytes).toString('base64'),
        created: createdAt,
        Recipient: {
          create: {
            name: signer.name,
            email: signer.email,
            token: documentToken,
            signedAt: createdAt,
            readStatus: ReadStatus.OPENED,
            signingStatus: SigningStatus.SIGNED,
            sendStatus: SendStatus.SENT,
          },
        },
      },
    });

    // Create fields and signatures.
    await Promise.all(
      fields.map((field) =>
        tx.field.create({
          data: {
            documentId: document.id,
            ...mapFields(field, signer),
            Signature:
              field.type === FieldType.SIGNATURE
                ? {
                    create: {
                      Recipient: {
                        connect: {
                          documentId_email: {
                            email: signer.email,
                            documentId: document.id,
                          },
                        },
                      },
                      signatureImageAsBase64: signatureImageAsBase64,
                      typedSignature,
                    },
                  }
                : undefined,
          },
        }),
      ),
    );

    return documentToken;
  });

  // Todo: Handle `downloadLink` and `reviewLink`.
  const template = createElement(DocumentSelfSignedEmailTemplate, {
    downloadLink: 'https://documenso.com',
    reviewLink: 'https://documenso.com',
    documentName: documentName,
    assetBaseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  });

  // Send email to signer.
  await mailer.sendMail({
    to: {
      address: signer.email,
      name: signer.name,
    },
    from: {
      name: FROM_NAME,
      address: FROM_ADDRESS,
    },
    subject: 'Document signed',
    html: render(template),
    text: render(template, { plainText: true }),
  });

  return documentToken;
};

/**
 * Map the fields provided by the user to fields compatible with Prisma.
 *
 * Signature fields are handled separately.
 *
 * @param field The field passed in by the user.
 * @param signer The details of the person who is signing this document.
 * @returns A field compatible with Prisma.
 */
const mapFields = (
  field: TCreateSinglePlayerDocumentSchema['fields'][number],
  signer: TCreateSinglePlayerDocumentSchema['signer'],
) => {
  let customText = '';

  switch (field.type) {
    case FieldType.DATE:
      customText = DateTime.now().toFormat('yyyy-MM-dd hh:mm a');
      break;

    case FieldType.EMAIL:
      customText = signer.email;
      break;

    case FieldType.NAME:
      customText = signer.name;
      break;
  }

  return {
    type: field.type,
    page: field.page,
    positionX: new Prisma.Decimal(field.positionX),
    positionY: new Prisma.Decimal(field.positionY),
    width: new Prisma.Decimal(field.width),
    height: new Prisma.Decimal(field.height),
    customText,
    inserted: true,
  };
};
