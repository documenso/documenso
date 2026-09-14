import fs from 'node:fs';
import path from 'node:path';
import { UNSAFE_replaceEnvelopeItemPdf } from '@documenso/lib/server-only/envelope-item/replace-envelope-item-pdf';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

/**
 * Replacing an envelope item's PDF already drops fields which fall beyond the
 * new page count. Contents have to be dropped for the same reason: at seal
 * time they are looked up by page, so one left behind is either drawn onto
 * the certificate or aborts the job.
 */

const singlePagePdf = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));
const multiPagePdf = fs.readFileSync(path.join(__dirname, '../../../../assets/field-font-alignment.pdf'));

const textMetaOnPage = (page: number) => ({
  type: EnvelopeContentType.TEXT,
  page,
  rotation: 0,
  positionX: 10,
  positionY: 10,
  width: 20,
  height: 6,
  text: `Page ${page}`,
});

const replacePdf = async (envelopeId: string, buffer: Buffer, name: string) => {
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: { recipients: true, envelopeItems: true, documentMeta: true },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: envelope.userId } });

  return await UNSAFE_replaceEnvelopeItemPdf({
    envelope,
    recipients: envelope.recipients,
    envelopeItemId: envelope.envelopeItems[0].id,
    oldDocumentDataId: envelope.envelopeItems[0].documentDataId,
    data: {
      file: new File([new Uint8Array(buffer)], name, { type: 'application/pdf' }),
    },
    user: { id: user.id, name: user.name, email: user.email },
    apiRequestMetadata: {
      requestMetadata: {},
      source: 'app',
      auth: null,
      auditUser: { id: user.id, name: user.name, email: user.email },
    },
  });
};

test('replacing a PDF drops contents which fall beyond the new page count', async () => {
  const { user, team } = await seedUser();

  const document = await seedBlankDocument(user, team.id, { internalVersion: 2 });

  // Start from a three page PDF.
  await replacePdf(document.id, multiPagePdf, 'multi-page.pdf');

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true },
  });

  const envelopeItemId = envelope.envelopeItems[0].id;

  await prisma.envelopeContent.createMany({
    data: [1, 3].map((page) => ({
      id: generateDatabaseId('envelope_content'),
      envelopeId: envelope.id,
      envelopeItemId,
      metadata: ZEnvelopeContentMetaSchema.parse(textMetaOnPage(page)),
    })),
  });

  await replacePdf(document.id, singlePagePdf, 'single-page.pdf');

  const contents = await prisma.envelopeContent.findMany({
    where: { envelopeId: envelope.id },
    select: { metadata: true },
  });

  // The page 1 content survives, the page 3 content is gone.
  expect(contents).toHaveLength(1);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const metadata = contents[0].metadata as { page?: number };

  expect(metadata.page).toBe(1);
});

test('replacing a PDF keeps a content which has no page of its own', async () => {
  const { user, team } = await seedUser();

  const document = await seedBlankDocument(user, team.id, { internalVersion: 2 });

  await replacePdf(document.id, multiPagePdf, 'multi-page.pdf');

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true },
  });

  // A content without a page belongs to the first page, so it always fits.
  await prisma.envelopeContent.create({
    data: {
      id: generateDatabaseId('envelope_content'),
      envelopeId: envelope.id,
      envelopeItemId: envelope.envelopeItems[0].id,
      metadata: ZEnvelopeContentMetaSchema.parse({
        type: EnvelopeContentType.TEXT,
        rotation: 0,
        positionX: 10,
        positionY: 10,
        width: 20,
        height: 6,
        text: 'No page',
      }),
    },
  });

  await replacePdf(document.id, singlePagePdf, 'single-page.pdf');

  const contents = await prisma.envelopeContent.findMany({ where: { envelopeId: envelope.id } });

  expect(contents).toHaveLength(1);
});

test('replacing a PDF keeps contents which still fit', async () => {
  const { user, team } = await seedUser();

  const document = await seedBlankDocument(user, team.id, { internalVersion: 2 });

  await replacePdf(document.id, multiPagePdf, 'multi-page.pdf');

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true },
  });

  await prisma.envelopeContent.createMany({
    data: [1, 2, 3].map((page) => ({
      id: generateDatabaseId('envelope_content'),
      envelopeId: envelope.id,
      envelopeItemId: envelope.envelopeItems[0].id,
      metadata: ZEnvelopeContentMetaSchema.parse(textMetaOnPage(page)),
    })),
  });

  // Replacing with another three page PDF leaves them all in place.
  await replacePdf(document.id, multiPagePdf, 'multi-page-again.pdf');

  const contents = await prisma.envelopeContent.findMany({ where: { envelopeId: envelope.id } });

  expect(contents).toHaveLength(3);
});
