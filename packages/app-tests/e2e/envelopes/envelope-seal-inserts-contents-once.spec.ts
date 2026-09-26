import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  EnvelopeContentShapeType,
  EnvelopeContentType,
  type TEnvelopeContentMetaInput,
} from '@documenso/lib/types/envelope-content-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type Page, test } from '@playwright/test';
import { DocumentStatus, RecipientRole } from '@prisma/client';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

/**
 * Contents are inserted into the PDF on send. The seal must then sign those
 * bytes as they are, not draw the contents a second time on top of them.
 *
 * A translucent fill makes a second draw measurable: two 40% layers of the
 * same colour compound to 64%, which reads as a much darker pixel.
 */

const FILL_OPACITY = 0.4;

const translucentGreen: TEnvelopeContentMetaInput = {
  type: EnvelopeContentType.SHAPE,
  shape: EnvelopeContentShapeType.RECTANGLE,
  page: 1,
  rotation: 0,
  positionX: 20,
  positionY: 20,
  width: 40,
  height: 30,
  // Pure green so red and blue are driven entirely by the opacity. The stroke
  // sits at the edge and the sample is taken at the centre, so it is ignored.
  fillColor: '#00ff00',
  fillOpacity: FILL_OPACITY,
};

/**
 * Red/blue channel of pure green at the given opacity over white.
 */
const channelAtOpacity = (opacity: number) => Math.round(255 * (1 - opacity));

const SINGLE_DRAW = channelAtOpacity(FILL_OPACITY);
const DOUBLE_DRAW = channelAtOpacity(1 - (1 - FILL_OPACITY) ** 2);

/**
 * Render the first page of a PDF and return the pixel at the centre of the
 * given percentage box.
 */
const samplePixelAtBoxCentre = async (
  pdfBytes: Uint8Array,
  box: { positionX: number; positionY: number; width: number; height: number },
) => {
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const canvasContext = canvas.getContext('2d');

  await page.render({
    // @ts-expect-error @napi-rs/canvas satisfies runtime requirements for pdfjs
    canvas,
    // @ts-expect-error @napi-rs/canvas satisfies runtime requirements for pdfjs
    canvasContext,
    viewport,
  }).promise;

  const x = Math.round(viewport.width * ((box.positionX + box.width / 2) / 100));
  const y = Math.round(viewport.height * ((box.positionY + box.height / 2) / 100));

  const [r, g, b] = canvasContext.getImageData(x, y, 1, 1).data;

  return { r, g, b };
};

const setupEnvelopeWithContent = async (page: Page) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id, { internalVersion: 2 });

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents` });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: document.id },
    include: { envelopeItems: { include: { documentData: true } } },
  });

  const envelopeItem = envelope.envelopeItems[0];

  const addContent = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.content.set`, {
    headers: { 'content-type': 'application/json', 'x-team-id': team.id.toString() },
    data: JSON.stringify({
      json: {
        envelopeId: envelope.id,
        contents: [{ envelopeItemId: envelopeItem.id, contentMeta: translucentGreen, dataContentId: null }],
      },
    }),
  });

  expect(addContent.ok()).toBeTruthy();

  // A CC-only envelope has nobody left to act, so sending it seals it at
  // once - through the real seal job, on the bytes the send just wrote.
  await prisma.recipient.create({
    data: {
      envelopeId: envelope.id,
      email: `cc-${nanoid(8)}@example.com`,
      name: 'Copied',
      token: nanoid(),
      role: RecipientRole.CC,
    },
  });

  return { envelope, envelopeItem, teamId: team.id };
};

test('sealing does not draw the contents a second time', async ({ page }) => {
  const { envelope, envelopeItem, teamId } = await setupEnvelopeWithContent(page);

  const sent = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.distribute`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({ json: { envelopeId: envelope.id } }),
  });

  expect(sent.ok()).toBeTruthy();

  await expect
    .poll(async () => (await prisma.envelope.findFirstOrThrow({ where: { id: envelope.id } })).status, {
      timeout: 30_000,
    })
    .toBe(DocumentStatus.COMPLETED);

  const sealed = await prisma.envelopeItem.findFirstOrThrow({
    where: { id: envelopeItem.id },
    include: { documentData: true },
  });

  const sealedBytes = await getFileServerSide(sealed.documentData);
  const pixel = await samplePixelAtBoxCentre(sealedBytes, translucentGreen);

  // Green stays saturated either way; red and blue tell the two apart.
  expect(pixel.g).toBeGreaterThan(240);
  expect(pixel.r).toBeGreaterThan((SINGLE_DRAW + DOUBLE_DRAW) / 2);
  expect(pixel.b).toBeGreaterThan((SINGLE_DRAW + DOUBLE_DRAW) / 2);

  // The original upload never had the content drawn on it at all.
  const originalBytes = await getFileServerSide({
    type: sealed.documentData.type,
    data: sealed.documentData.initialData,
  });
  const originalPixel = await samplePixelAtBoxCentre(originalBytes, translucentGreen);

  expect(originalPixel).toEqual({ r: 255, g: 255, b: 255 });
});
