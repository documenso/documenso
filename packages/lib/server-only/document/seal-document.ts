'use server';

import { PDFDocument } from 'pdf-lib';

import { prisma } from '@documenso/prisma';
import { DocumentStatus, SigningStatus } from '@documenso/prisma/client';

import { insertFieldInPDF } from '../pdf/insert-field-in-pdf';

export type SealDocumentOptions = {
  documentId: number;
};

export const sealDocument = async ({ documentId }: SealDocumentOptions) => {
  'use server';

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
  });

  if (document.status !== DocumentStatus.COMPLETED) {
    throw new Error(`Document ${document.id} has not been completed`);
  }

  const recipients = await prisma.recipient.findMany({
    where: {
      documentId: document.id,
    },
  });

  if (recipients.some((recipient) => recipient.signingStatus !== SigningStatus.SIGNED)) {
    throw new Error(`Document ${document.id} has unsigned recipients`);
  }

  const fields = await prisma.field.findMany({
    where: {
      documentId: document.id,
    },
    include: {
      Signature: true,
    },
  });

  if (fields.some((field) => !field.inserted)) {
    throw new Error(`Document ${document.id} has unsigned fields`);
  }

  // !: Need to write the fields onto the document as a hard copy
  const { document: pdfData } = document;

  const doc = await PDFDocument.load(pdfData);

  for (const field of fields) {
    console.log('inserting field', {
      ...field,
      Signature: null,
    });
    await insertFieldInPDF(doc, field);
  }

  const pdfBytes = await doc.save();

  await prisma.document.update({
    where: {
      id: document.id,
      status: DocumentStatus.COMPLETED,
    },
    data: {
      document: Buffer.from(pdfBytes).toString('base64'),
    },
  });
};
