import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  EnvelopeContentShapeType,
  EnvelopeContentType,
  type TEnvelopeContentMetaInput,
  ZEnvelopeContentMetaSchema,
} from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { getKonvaElementCountForPage } from '../fixtures/konva';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

/**
 * Contents are rendered into the PDF when the envelope is sent, so everything
 * after DRAFT works from bytes which already contain them. The signer never
 * draws them and never fetches their images.
 */

const rectangleMeta: TEnvelopeContentMetaInput = {
  type: EnvelopeContentType.SHAPE,
  shape: EnvelopeContentShapeType.RECTANGLE,
  page: 1,
  rotation: 0,
  positionX: 10,
  positionY: 10,
  width: 30,
  height: 20,
  fillColor: '#ff0000',
  fillOpacity: 1,
};

const setupSendableDocument = async (page: Page) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id, { internalVersion: 2 });

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents` });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: document.id },
    include: { envelopeItems: { include: { documentData: true } } },
  });

  const envelopeItem = envelope.envelopeItems[0];

  // A signer with a signature field, so the envelope is sendable.
  const recipient = await prisma.recipient.create({
    data: {
      envelopeId: envelope.id,
      email: `signer-${nanoid(8)}@example.com`,
      name: 'Signer',
      token: nanoid(),
    },
  });

  await prisma.field.create({
    data: {
      envelopeId: envelope.id,
      envelopeItemId: envelopeItem.id,
      recipientId: recipient.id,
      type: FieldType.SIGNATURE,
      page: 1,
      positionX: 60,
      positionY: 60,
      width: 20,
      height: 8,
      customText: '',
      inserted: false,
      fieldMeta: { type: 'signature', overflow: 'auto' },
    },
  });

  return { envelope, envelopeItem, teamId: team.id, recipientToken: recipient.token };
};

const addContent = async (page: Page, teamId: number, envelopeId: string, envelopeItemId: string) =>
  await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.content.set`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({
      json: { envelopeId, contents: [{ envelopeItemId, contentMeta: rectangleMeta, dataContentId: null }] },
    }),
  });

const sendDocument = async (page: Page, teamId: number, envelopeId: string) =>
  await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.distribute`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({ json: { envelopeId } }),
  });

test('sending renders the contents into the pdf while keeping the original', async ({ page }) => {
  const { envelope, envelopeItem, teamId } = await setupSendableDocument(page);

  const originalDataId = envelopeItem.documentDataId;
  const originalInitialData = envelopeItem.documentData.initialData;

  expect((await addContent(page, teamId, envelope.id, envelopeItem.id)).ok()).toBeTruthy();

  const sent = await sendDocument(page, teamId, envelope.id);

  expect(sent.ok()).toBeTruthy();

  const after = await prisma.envelopeItem.findFirstOrThrow({
    where: { id: envelopeItem.id },
    include: { documentData: true },
  });

  // A new document data was written...
  expect(after.documentDataId).not.toBe(originalDataId);
  // ...with the contents in it...
  expect(after.documentData.data).not.toBe(originalInitialData);
  // ...but the original upload is untouched.
  expect(after.documentData.initialData).toBe(originalInitialData);
});

test('the signer page does not draw contents or request their images', async ({ page }) => {
  const { envelope, envelopeItem, teamId, recipientToken } = await setupSendableDocument(page);

  await addContent(page, teamId, envelope.id, envelopeItem.id);

  expect((await sendDocument(page, teamId, envelope.id)).ok()).toBeTruthy();

  const imageRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/dataContent/')) {
      imageRequests.push(request.url());
    }
  });

  await page.goto(`${WEBAPP_BASE_URL}/sign/${recipientToken}`);
  await page.locator('.konva-container canvas').first().waitFor({ state: 'visible' });

  // The signature field is drawn on the canvas, the content is not.
  await expect.poll(async () => await getKonvaElementCountForPage(page, 1, '.field-group')).toBe(1);

  expect(await getKonvaElementCountForPage(page, 1, '.content-group')).toBe(0);
  expect(imageRequests).toEqual([]);
});

test('sending is blocked when a content image cannot be loaded', async ({ page }) => {
  const { envelope, envelopeItem, teamId } = await setupSendableDocument(page);

  // An image content with no image attached to it.
  await prisma.envelopeContent.create({
    data: {
      id: generateDatabaseId('envelope_content'),
      envelopeId: envelope.id,
      envelopeItemId: envelopeItem.id,
      dataContentId: null,
      contentMeta: ZEnvelopeContentMetaSchema.parse({
        type: EnvelopeContentType.IMAGE,
        page: 1,
        rotation: 0,
        positionX: 10,
        positionY: 10,
        width: 30,
        height: 20,
      }),
    },
  });

  const sent = await sendDocument(page, teamId, envelope.id);

  expect(sent.status()).toBe(400);
  expect(await sent.text()).toContain('MISSING_CONTENT_IMAGE');

  // Nothing was inserted and the envelope is still a draft.
  const after = await prisma.envelope.findFirstOrThrow({
    where: { id: envelope.id },
    include: { envelopeItems: true },
  });

  expect(after.status).toBe(DocumentStatus.DRAFT);
  expect(after.envelopeItems[0].documentDataId).toBe(envelopeItem.documentDataId);
});
