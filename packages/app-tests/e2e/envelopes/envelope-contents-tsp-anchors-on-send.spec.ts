import { buildTspAnchorName, buildTspStampName } from '@documenso/ee/server-only/signing/csc/pdf-names';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  EnvelopeContentShapeType,
  EnvelopeContentType,
  type TEnvelopeContentMetaInput,
} from '@documenso/lib/types/envelope-content-meta';
import { SignatureLevel } from '@documenso/lib/types/signature-level';
import { nanoid } from '@documenso/lib/universal/id';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { PDF } from '@libpdf/core';
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { samplePixelAtBoxCentre } from '../fixtures/pdf-pixels';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

/**
 * On an AES/QES envelope the send both renders the contents into the PDF and
 * materialises the TSP signature anchors onto it. The render flattens the PDF,
 * so the anchors have to be added onto the rendered bytes, and the item has to
 * end up pointing at a single file which carries both.
 */

const opaqueRed: TEnvelopeContentMetaInput = {
  type: EnvelopeContentType.SHAPE,
  shape: EnvelopeContentShapeType.RECTANGLE,
  page: 1,
  rotation: 0,
  positionX: 20,
  positionY: 20,
  width: 40,
  height: 30,
  fillColor: '#ff0000',
  fillOpacity: 1,
};

test('sending an AES envelope puts the contents and the tsp anchors into the same file', async ({ page }) => {
  const { user, team } = await seedUser();

  const document = await seedBlankDocument(user, team.id, {
    internalVersion: 2,
    createDocumentOptions: {
      signatureLevel: SignatureLevel.AES,
    },
  });

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents` });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: document.id },
    include: { envelopeItems: { include: { documentData: true } } },
  });

  const envelopeItem = envelope.envelopeItems[0];

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

  const contentsSet = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.content.set`, {
    headers: { 'content-type': 'application/json', 'x-team-id': team.id.toString() },
    data: JSON.stringify({
      json: {
        envelopeId: envelope.id,
        contents: [{ envelopeItemId: envelopeItem.id, contentMeta: opaqueRed, dataContentId: null }],
      },
    }),
  });

  expect(contentsSet.ok()).toBeTruthy();

  const sent = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.distribute`, {
    headers: { 'content-type': 'application/json', 'x-team-id': team.id.toString() },
    data: JSON.stringify({ json: { envelopeId: envelope.id } }),
  });

  expect(sent.ok()).toBeTruthy();

  const after = await prisma.envelopeItem.findFirstOrThrow({
    where: { id: envelopeItem.id },
    include: { documentData: true, envelope: true },
  });

  expect(after.envelope.status).toBe(DocumentStatus.PENDING);
  expect(after.documentDataId).not.toBe(envelopeItem.documentDataId);
  expect(after.documentData.initialData).toBe(envelopeItem.documentData.initialData);

  const sentBytes = await getFileServerSide(after.documentData);

  // The content is drawn into the file the item now points at...
  const pixel = await samplePixelAtBoxCentre(sentBytes, opaqueRed);

  expect(pixel.r).toBeGreaterThan(240);
  expect(pixel.g).toBeLessThan(15);
  expect(pixel.b).toBeLessThan(15);

  // ...and so are the TSP anchor and the page stamp for the signer.
  const pdf = await PDF.load(sentBytes);

  const anchorName = buildTspAnchorName(recipient.id, envelopeItem.id);
  const stampName = buildTspStampName(recipient.id, envelopeItem.id, 1);

  expect(pdf.getForm()?.getSignatureField(anchorName)).toBeTruthy();

  const firstPage = pdf.getPage(0);

  expect(firstPage).toBeTruthy();
  expect(firstPage?.getStampAnnotations().some((stamp) => stamp.stampName === stampName)).toBe(true);

  // The original upload carries neither.
  const originalBytes = await getFileServerSide({
    type: after.documentData.type,
    data: after.documentData.initialData,
  });

  expect(await samplePixelAtBoxCentre(originalBytes, opaqueRed)).toEqual({ r: 255, g: 255, b: 255 });

  const originalPdf = await PDF.load(originalBytes);

  expect(originalPdf.getForm()?.getSignatureField(anchorName)).toBeFalsy();
});
