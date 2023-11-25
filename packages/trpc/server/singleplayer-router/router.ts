import { createElement } from 'react';

import { performance } from 'node:perf_hooks';
import { PDFDocument } from 'pdf-lib';

import { mailer } from '@documenso/email/mailer';
import { renderAsync } from '@documenso/email/render';
import { DocumentSelfSignedEmailTemplate } from '@documenso/email/templates/document-self-signed';
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

const timer = (label: string) => {
  const start = performance.now();

  return () => {
    const end = performance.now();
    console.log(`${label}: ${end - start}ms`);
  };
};

export const singleplayerRouter = router({
  createSinglePlayerDocument: procedure
    .input(ZCreateSinglePlayerDocumentMutationSchema)
    .mutation(async ({ input }) => {
      const { signer, fields, documentData, documentName } = input;

      const stopGetFileTimer = timer('getFile');
      const document = await getFile({
        data: documentData.data,
        type: documentData.type,
      });
      stopGetFileTimer();

      const stopLoadPdfTimer = timer('loadPdf');
      const doc = await PDFDocument.load(document);
      stopLoadPdfTimer();
      const createdAt = new Date();

      const isBase64 = signer.signature.startsWith('data:image/png;base64,');
      const signatureImageAsBase64 = isBase64 ? signer.signature : null;
      const typedSignature = !isBase64 ? signer.signature : null;

      const stopInsertFieldsTimer = timer('insertFields');
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
          documentId: -1,
          recipientId: -1,
        });
      }
      stopInsertFieldsTimer();

      const stopSavePdfTimer = timer('savePdf');
      const unsignedPdfBytes = await doc.save();
      stopSavePdfTimer();

      const stopSignPdfTimer = timer('signPdf');
      const signedPdfBuffer = await signPdf({ pdf: Buffer.from(unsignedPdfBytes) });
      stopSignPdfTimer();

      const stopCreateDocumentTimer = timer('createDocument');
      const { token } = await prisma.$transaction(
        async (tx) => {
          const token = alphaid();

          // Fetch service user who will be the owner of the document.
          const serviceUser = await tx.user.findFirstOrThrow({
            where: {
              email: SERVICE_USER_EMAIL,
            },
          });

          const stopPutFileTimer = timer('putFile');
          const { id: documentDataId } = await putFile({
            name: `${documentName}.pdf`,
            type: 'application/pdf',
            arrayBuffer: async () => Promise.resolve(signedPdfBuffer),
          });
          stopPutFileTimer();

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

          const stopCreateFieldsTimer = timer('createFields');
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
          stopCreateFieldsTimer();

          return { document, token };
        },
        {
          maxWait: 5000,
          timeout: 30000,
        },
      );
      stopCreateDocumentTimer();

      const template = createElement(DocumentSelfSignedEmailTemplate, {
        documentName: documentName,
        assetBaseUrl: process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000',
      });

      const stopRenderTimer = timer('render');
      const [html, text] = await Promise.all([
        renderAsync(template),
        renderAsync(template, { plainText: true }),
      ]);
      stopRenderTimer();

      const stopSendEmailTimer = timer('sendEmail');
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
      stopSendEmailTimer();

      return token;
    }),
});
