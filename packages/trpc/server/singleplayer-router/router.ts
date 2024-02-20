import { createElement } from 'react';

import { PDFDocument } from 'pdf-lib';

import { mailer } from '@documenso/email/mailer';
import { renderAsync } from '@documenso/email/render';
import { DocumentSelfSignedEmailTemplate } from '@documenso/email/templates/document-self-signed';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME, SERVICE_USER_EMAIL } from '@documenso/lib/constants/email';
import { insertFieldInPDF } from '@documenso/lib/server-only/pdf/insert-field-in-pdf';
import { alphaid } from '@documenso/lib/universal/id';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  FieldType,
  ReadStatus,
  SendStatus,
  SigningStatus,
} from '@documenso/prisma/client';
import { signPdf } from '@documenso/signing';

import { procedure, router } from '../trpc';
import { mapField } from './helper';
import { ZCreateSinglePlayerDocumentMutationSchema } from './schema';

export const singleplayerRouter = router({
  createSinglePlayerDocument: procedure
    .input(ZCreateSinglePlayerDocumentMutationSchema)
    .mutation(async ({ input }) => {
      const { signer, fields, documentData, documentName } = input;

      const document = await getFile({
        data: documentData.data,
        type: documentData.type,
      });

      const doc = await PDFDocument.load(document);

      const createdAt = new Date();

      const isBase64 = signer.signature.startsWith('data:image/png;base64,');
      const signatureImageAsBase64 = isBase64 ? signer.signature : null;
      const typedSignature = !isBase64 ? signer.signature : null;

      // Update the document with the fields inserted.
      for (const field of fields) {
        const isSignatureField = field.type === FieldType.SIGNATURE;

        await insertFieldInPDF(doc, {
          ...mapField(field, signer),
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
          secondaryId: '-1',
          documentId: -1,
          templateId: null,
          recipientId: -1,
        });
      }

      const unsignedPdfBytes = await doc.save();

      const signedPdfBuffer = await signPdf({ pdf: Buffer.from(unsignedPdfBytes) });

      const { token } = await prisma.$transaction(
        async (tx) => {
          const token = alphaid();

          // Fetch service user who will be the owner of the document.
          const serviceUser = await tx.user.findFirstOrThrow({
            where: {
              email: SERVICE_USER_EMAIL,
            },
          });

          const { id: documentDataId } = await putFile({
            name: `${documentName}.pdf`,
            type: 'application/pdf',
            arrayBuffer: async () => Promise.resolve(signedPdfBuffer),
          });

          // Create document.
          const document = await tx.document.create({
            data: {
              title: documentName,
              status: DocumentStatus.COMPLETED,
              documentDataId,
              userId: serviceUser.id,
              createdAt,
            },
          });

          // Create recipient.
          const recipient = await tx.recipient.create({
            data: {
              documentId: document.id,
              name: signer.name,
              email: signer.email,
              token,
              signedAt: createdAt,
              readStatus: ReadStatus.OPENED,
              signingStatus: SigningStatus.SIGNED,
              sendStatus: SendStatus.SENT,
            },
          });

          // Create fields and signatures.
          await Promise.all(
            fields.map(async (field) => {
              const insertedField = await tx.field.create({
                data: {
                  documentId: document.id,
                  recipientId: recipient.id,
                  ...mapField(field, signer),
                },
              });

              if (field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE) {
                await tx.signature.create({
                  data: {
                    fieldId: insertedField.id,
                    signatureImageAsBase64,
                    typedSignature,
                    recipientId: recipient.id,
                  },
                });
              }
            }),
          );

          return { document, token };
        },
        {
          maxWait: 5000,
          timeout: 30000,
        },
      );

      const template = createElement(DocumentSelfSignedEmailTemplate, {
        documentName: documentName,
        assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000',
      });

      const [html, text] = await Promise.all([
        renderAsync(template),
        renderAsync(template, { plainText: true }),
      ]);

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
        html,
        text,
        attachments: [{ content: signedPdfBuffer, filename: documentName }],
      });

      return token;
    }),
});
