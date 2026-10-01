import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  EnvelopeContentShapeType,
  EnvelopeContentType,
  type TEnvelopeContentMetaInput,
  ZEnvelopeContentMetaSchema,
} from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { type DocumentDataType, DocumentStatus, FieldType } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { getKonvaElementCountForPage } from '../fixtures/konva';
import { channelAtOpacity, samplePixelAtBoxCentre } from '../fixtures/pdf-pixels';

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

/**
 * Replace the envelope's contents with the given ones. Passing a single
 * envelope item ID sets one rectangle on that item.
 */
const setContents = async (
  page: Page,
  teamId: number,
  envelopeId: string,
  contents: { envelopeItemId: string; contentMeta: TEnvelopeContentMetaInput }[],
) =>
  await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.content.set`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({
      json: {
        envelopeId,
        contents: contents.map((content) => ({ ...content, dataContentId: null })),
      },
    }),
  });

const addContent = async (page: Page, teamId: number, envelopeId: string, envelopeItemId: string) =>
  await setContents(page, teamId, envelopeId, [{ envelopeItemId, contentMeta: rectangleMeta }]);

/**
 * Add a second envelope item to the envelope, backed by a copy of the given
 * item's document data.
 */
const addSecondEnvelopeItem = async (
  envelopeId: string,
  firstEnvelopeItem: { documentData: { type: DocumentDataType; data: string; initialData: string } },
) => {
  const documentData = await prisma.documentData.create({
    data: {
      type: firstEnvelopeItem.documentData.type,
      data: firstEnvelopeItem.documentData.data,
      initialData: firstEnvelopeItem.documentData.initialData,
    },
  });

  return await prisma.envelopeItem.create({
    data: {
      id: generateDatabaseId('envelope_item'),
      envelopeId,
      title: 'Second item',
      documentDataId: documentData.id,
      order: 2,
    },
  });
};

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

test('a failed send leaves every pdf on its original file', async ({ page }) => {
  const { envelope, envelopeItem, teamId } = await setupSendableDocument(page);

  const secondEnvelopeItem = await addSecondEnvelopeItem(envelope.id, envelopeItem);

  // A valid content on the first item, and one on a page the second item does
  // not have, which fails the render of the second item only.
  const contentsSet = await setContents(page, teamId, envelope.id, [
    { envelopeItemId: envelopeItem.id, contentMeta: rectangleMeta },
    { envelopeItemId: secondEnvelopeItem.id, contentMeta: { ...rectangleMeta, page: 999 } },
  ]);

  expect(contentsSet.ok()).toBeTruthy();

  const sent = await sendDocument(page, teamId, envelope.id);

  expect(sent.ok()).toBeFalsy();
  expect(await sent.text()).toContain('Page 999 does not exist');

  // The send fails as soon as the second item does, so a render of the first
  // item which was still switching itself in after the response had gone out
  // is given time to land before the check.
  await page.waitForTimeout(3_000);

  const after = await prisma.envelope.findFirstOrThrow({
    where: { id: envelope.id },
    include: { envelopeItems: { orderBy: { order: 'asc' } } },
  });

  // The envelope is still a draft, and neither item was switched to a rendered
  // file, including the first one whose render succeeded.
  expect(after.status).toBe(DocumentStatus.DRAFT);
  expect(after.envelopeItems[0].documentDataId).toBe(envelopeItem.documentDataId);
  expect(after.envelopeItems[1].documentDataId).toBe(secondEnvelopeItem.documentDataId);

  // Once the bad page is fixed the send goes through and both items switch.
  const badContent = await prisma.envelopeContent.findFirstOrThrow({
    where: { envelopeItemId: secondEnvelopeItem.id },
  });

  await prisma.envelopeContent.update({
    where: { id: badContent.id },
    data: { contentMeta: ZEnvelopeContentMetaSchema.parse(rectangleMeta) },
  });

  expect((await sendDocument(page, teamId, envelope.id)).ok()).toBeTruthy();

  const resent = await prisma.envelope.findFirstOrThrow({
    where: { id: envelope.id },
    include: { envelopeItems: { orderBy: { order: 'asc' } } },
  });

  expect(resent.status).toBe(DocumentStatus.PENDING);
  expect(resent.envelopeItems[0].documentDataId).not.toBe(envelopeItem.documentDataId);
  expect(resent.envelopeItems[1].documentDataId).not.toBe(secondEnvelopeItem.documentDataId);
});

test('two concurrent sends draw the contents once', async ({ page }) => {
  const { envelope, envelopeItem, teamId } = await setupSendableDocument(page);

  const fillOpacity = 0.4;

  const translucentGreen: TEnvelopeContentMetaInput = {
    ...rectangleMeta,
    fillColor: '#00ff00',
    fillOpacity,
  };

  expect(
    (
      await setContents(page, teamId, envelope.id, [{ envelopeItemId: envelopeItem.id, contentMeta: translucentGreen }])
    ).ok(),
  ).toBeTruthy();

  const [first, second] = await Promise.all([
    sendDocument(page, teamId, envelope.id),
    sendDocument(page, teamId, envelope.id),
  ]);

  // Depending on timing the later request either finds the envelope already
  // pending and sends again without rendering, or rendered alongside the
  // first and is turned away when it tries to switch the item. Never a crash.
  for (const response of [first, second]) {
    expect([200, 400]).toContain(response.status());

    if (response.status() === 400) {
      expect(await response.text()).toContain('was modified while its contents were being inserted');
    }
  }

  expect(first.ok() || second.ok()).toBeTruthy();

  const after = await prisma.envelopeItem.findFirstOrThrow({
    where: { id: envelopeItem.id },
    include: { documentData: true, envelope: true },
  });

  expect(after.envelope.status).toBe(DocumentStatus.PENDING);
  expect(after.documentDataId).not.toBe(envelopeItem.documentDataId);

  // The item's file has the content drawn exactly once. A second draw of the
  // same translucent colour would compound into a much darker pixel.
  const singleDraw = channelAtOpacity(fillOpacity);
  const doubleDraw = channelAtOpacity(1 - (1 - fillOpacity) ** 2);

  const pixel = await samplePixelAtBoxCentre(await getFileServerSide(after.documentData), translucentGreen);

  expect(pixel.g).toBeGreaterThan(240);
  expect(pixel.r).toBeGreaterThan((singleDraw + doubleDraw) / 2);
  expect(pixel.b).toBeGreaterThan((singleDraw + doubleDraw) / 2);
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
