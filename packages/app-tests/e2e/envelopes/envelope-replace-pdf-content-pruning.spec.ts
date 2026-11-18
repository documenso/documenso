import fs from 'node:fs';
import path from 'node:path';
import { UNSAFE_replaceEnvelopeItemPdf } from '@documenso/lib/server-only/envelope-item/replace-envelope-item-pdf';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
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
  positionX: 10,
  positionY: 10,
  width: 20,
  height: 6,
  text: `Page ${page}`,
});

/**
 * The type name is written out since the module declaring it carries lingui
 * macros the test runner cannot transform.
 */
const getContentDeletedLogs = async (envelopeId: string) =>
  await prisma.documentAuditLog.findMany({ where: { envelopeId, type: 'CONTENT_DELETED' } });

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

  const [pageOneContentId, pageThreeContentId] = [
    generateDatabaseId('envelope_content'),
    generateDatabaseId('envelope_content'),
  ];

  await prisma.envelopeContent.createMany({
    data: [
      { id: pageOneContentId, page: 1 },
      { id: pageThreeContentId, page: 3 },
    ].map(({ id, page }) => ({
      id,
      envelopeId: envelope.id,
      envelopeItemId,
      contentMeta: ZEnvelopeContentMetaSchema.parse(textMetaOnPage(page)),
    })),
  });

  await replacePdf(document.id, singlePagePdf, 'single-page.pdf');

  const contents = await prisma.envelopeContent.findMany({
    where: { envelopeId: envelope.id },
    select: { id: true, contentMeta: true },
  });

  // The page 1 content survives, the page 3 content is gone.
  expect(contents).toHaveLength(1);
  expect(contents[0].id).toBe(pageOneContentId);

  // The dropped content is logged the same way one removed in the editor is,
  // attributed to the user who replaced the PDF.
  const deletedLogs = await getContentDeletedLogs(envelope.id);

  expect(deletedLogs).toHaveLength(1);
  expect(deletedLogs[0].data).toEqual({
    contentId: pageThreeContentId,
    contentType: EnvelopeContentType.TEXT,
    envelopeItemId,
  });
  expect(deletedLogs[0].userId).toBe(user.id);
  expect(deletedLogs[0].email).toBe(user.email);
});

test('replacing a PDF on a template drops contents without logging', async () => {
  const { user, team } = await seedUser();

  const template = await seedBlankTemplate(user, team.id, { createTemplateOptions: { internalVersion: 2 } });

  await replacePdf(template.id, multiPagePdf, 'multi-page.pdf');

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: template.id },
    include: { envelopeItems: true },
  });

  await prisma.envelopeContent.createMany({
    data: [1, 3].map((page) => ({
      id: generateDatabaseId('envelope_content'),
      envelopeId: envelope.id,
      envelopeItemId: envelope.envelopeItems[0].id,
      contentMeta: ZEnvelopeContentMetaSchema.parse(textMetaOnPage(page)),
    })),
  });

  await replacePdf(template.id, singlePagePdf, 'single-page.pdf');

  expect(await prisma.envelopeContent.count({ where: { envelopeId: envelope.id } })).toBe(1);
  expect(await getContentDeletedLogs(envelope.id)).toHaveLength(0);
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
      contentMeta: ZEnvelopeContentMetaSchema.parse(textMetaOnPage(page)),
    })),
  });

  // Replacing with another three page PDF leaves them all in place.
  await replacePdf(document.id, multiPagePdf, 'multi-page-again.pdf');

  const contents = await prisma.envelopeContent.findMany({ where: { envelopeId: envelope.id } });

  expect(contents).toHaveLength(3);
  expect(await getContentDeletedLogs(envelope.id)).toHaveLength(0);
});
