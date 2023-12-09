import { type Page, expect } from '@playwright/test';

import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { prisma } from '@documenso/prisma';
import type { DocumentStatus } from '@documenso/prisma/client';
import { FieldType, Prisma, ReadStatus, SendStatus, SigningStatus } from '@documenso/prisma/client';

type uploadDocumentsOption = {
  pdf: Buffer;
  pdfName: string;
};

type User = { name: string; email: string };

type createDraftDocumentOptions = {
  document: Buffer;
  userId: number;
  title: string;
  recipients: User[];
};

type TDocument = Awaited<ReturnType<typeof createDocument>>;

type TDocumentFixture = ReturnType<typeof createDocumentFixture>;

type createTestDocumentOptions = {
  pdf: Buffer;
  title: string;
  userId: number;
  status: DocumentStatus;
};

const createDocumentFixture = (document: TDocument) => {
  return document;
};

type createRecipientOptions = {
  recipients: User[];
  document: TDocument;
  status: 'completed' | 'draft' | 'pending';
};

async function createTestDocument({ status, title, pdf, userId }: createTestDocumentOptions) {
  const documentData = await createDocumentData({
    data: pdf.toString('base64'),
    type: 'BYTES_64',
  });

  const document = await createDocument({
    documentDataId: documentData.id,
    title,
    userId,
    status,
  });
  return document;
}

async function createRecipient({ document, recipients, status }: createRecipientOptions) {
  const isDraft = status === 'draft';
  const isCompleted = status === 'completed';

  for (const recipient of recipients) {
    const index = recipients.indexOf(recipient);

    await prisma.recipient.create({
      data: {
        email: String(recipient.email),
        name: String(recipient.name),
        token: `${status}-token-${index}`,
        readStatus: isCompleted ? ReadStatus.OPENED : ReadStatus.NOT_OPENED,
        sendStatus: isDraft ? SendStatus.NOT_SENT : SendStatus.SENT,
        signingStatus: isCompleted ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
        signedAt: isCompleted ? new Date() : null,
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
}

export const createDocumentsFixture = (page: Page) => {
  const store: { documents: TDocumentFixture[]; page: Page } = { documents: [], page };
  return {
    upload: async ({ pdf, pdfName }: uploadDocumentsOption) => {
      await expect(page).toHaveURL('/documents');

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('input[type=file]').evaluate((e) => {
          if (e instanceof HTMLInputElement) {
            e.click();
          }
        }),
      ]);

      await fileChooser.setFiles({
        buffer: pdf,
        mimeType: 'application/pdf',
        name: pdfName,
      });
    },

    createCompletedDocument: async ({
      document: pdf,
      userId,
      title,
      recipients,
    }: createDraftDocumentOptions) => {
      const document = await createTestDocument({ pdf, title, userId, status: 'COMPLETED' });

      await createRecipient({ recipients, document, status: 'completed' });

      const documentFixture = createDocumentFixture(document);
      store.documents.push(documentFixture);
      return documentFixture;
    },

    createPendingDocument: async ({
      document: pdf,
      userId,
      title,
      recipients,
    }: createDraftDocumentOptions) => {
      const document = await createTestDocument({ pdf, title, userId, status: 'PENDING' });

      await createRecipient({ recipients, document, status: 'pending' });

      const documentFixture = createDocumentFixture(document);
      store.documents.push(documentFixture);
      return documentFixture;
    },
    createDraftDocument: async ({
      document: pdf,
      userId,
      title,
      recipients,
    }: createDraftDocumentOptions) => {
      const document = await createTestDocument({ pdf, title, userId, status: 'DRAFT' });

      await createRecipient({ recipients, document, status: 'draft' });

      const documentFixture = createDocumentFixture(document);
      store.documents.push(documentFixture);
      return documentFixture;
    },
    deleteAll: async () => {
      const ids = store.documents.map((u) => u.id);
      await prisma.document.deleteMany({ where: { id: { in: ids } } });
      // eslint-disable-next-line require-atomic-updates
      store.documents = [];
    },
  };
};
