import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createDataContentImage } from '@documenso/lib/server-only/data-content/create-data-content-image';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type Page, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

/**
 * A data content (e.g. an uploaded image) is an immutable blob which any
 * number of contents may point at. Copying a template shares its images with
 * the new document rather than duplicating them, and removing a content never
 * deletes the data content behind it.
 */

const createPng = async () => {
  const canvas = createCanvas(60, 30);
  const context = canvas.getContext('2d');

  context.fillStyle = 'rgb(30, 120, 220)';
  context.fillRect(0, 0, 60, 30);

  return await canvas.encode('png');
};

const seedTemplateWithImageContent = async (page: Page) => {
  const { user, team } = await seedUser();

  const template = await seedBlankTemplate(user, team.id, { internalVersion: 2 });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: template.id },
    include: { envelopeItems: true },
  });

  const recipient = await prisma.recipient.create({
    data: {
      envelopeId: envelope.id,
      email: `signer-${nanoid(8)}@example.com`,
      name: 'Signer',
      token: nanoid(),
    },
  });

  const png = await createPng();

  const dataContent = await createDataContentImage({
    file: { name: 'image.png', arrayBuffer: async () => png.buffer as ArrayBuffer },
  });

  await prisma.envelopeContent.create({
    data: {
      id: generateDatabaseId('envelope_content'),
      envelopeId: envelope.id,
      envelopeItemId: envelope.envelopeItems[0].id,
      dataContentId: dataContent.id,
      contentMeta: ZEnvelopeContentMetaSchema.parse({
        type: EnvelopeContentType.IMAGE,
        page: 1,
        rotation: 0,
        zIndex: 0,
        positionX: 10,
        positionY: 10,
        width: 20,
        height: 10,
      }),
    },
  });

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/templates` });

  return { envelope, recipient, dataContentId: dataContent.id, teamId: team.id };
};

const createDocumentFromTemplate = async (
  page: Page,
  teamId: number,
  templateSecondaryId: string,
  recipient: { id: number; email: string; name: string },
) => {
  const res = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/template.createDocumentFromTemplate`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({
      json: {
        templateId: mapSecondaryIdToTemplateId(templateSecondaryId),
        recipients: [{ id: recipient.id, email: recipient.email, name: recipient.name }],
      },
    }),
  });

  expect(res.ok()).toBeTruthy();

  const body = await res.json();

  // The route answers with the legacy document shape, whose `id` is the
  // numeric document ID; `envelopeId` is the envelope's own ID.
  return body.result.data.json.envelopeId as string;
};

test('a document created from a template shares its data contents', async ({ page }) => {
  const { envelope, recipient, dataContentId, teamId } = await seedTemplateWithImageContent(page);

  const documentId = await createDocumentFromTemplate(page, teamId, envelope.secondaryId, recipient);

  const copied = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: documentId } });

  // Same row, not a copy of it.
  expect(copied.dataContentId).toBe(dataContentId);
  expect(await prisma.dataContent.count({ where: { id: dataContentId } })).toBe(1);

  // Both contents point at it.
  expect(await prisma.envelopeContent.count({ where: { dataContentId } })).toBe(2);
});

test('removing a content leaves the shared data content in place', async ({ page }) => {
  const { envelope, recipient, dataContentId, teamId } = await seedTemplateWithImageContent(page);

  const documentId = await createDocumentFromTemplate(page, teamId, envelope.secondaryId, recipient);

  // Save the document with no contents, removing the copied one.
  const removed = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.content.set`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({ json: { envelopeId: documentId, contents: [] } }),
  });

  expect(removed.ok()).toBeTruthy();
  expect(await prisma.envelopeContent.count({ where: { envelopeId: documentId } })).toBe(0);

  // The template's content still has its image.
  expect(await prisma.dataContent.count({ where: { id: dataContentId } })).toBe(1);

  const templateContent = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  expect(templateContent.dataContentId).toBe(dataContentId);
});
