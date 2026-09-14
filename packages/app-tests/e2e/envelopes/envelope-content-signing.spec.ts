import { createImageDataContent } from '@documenso/lib/server-only/data-content/create-image-data-content';
import { ContentShapeType, EnvelopeContentType } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedCompletedDocument, seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type Page, test } from '@playwright/test';
import { DocumentDataType } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { getContentGroupsForPage, getPageCanvas } from '../fixtures/contents';

/**
 * Seed a text content and a rectangle onto the first page of an envelope.
 */
const seedStaticContents = async (envelopeId: string, envelopeItemId: string) => {
  await prisma.envelopeContent.createMany({
    data: [
      {
        id: generateDatabaseId('envelope_content'),
        envelopeId,
        envelopeItemId,
        metadata: {
          type: EnvelopeContentType.TEXT,
          page: 1,
          rotation: 0,
          positionX: 10,
          positionY: 10,
          width: 40,
          height: 6,
          text: 'Signing content',
        },
      },
      {
        id: generateDatabaseId('envelope_content'),
        envelopeId,
        envelopeItemId,
        metadata: {
          type: EnvelopeContentType.SHAPE,
          shape: ContentShapeType.RECTANGLE,
          page: 1,
          rotation: 0,
          positionX: 10,
          positionY: 20,
          width: 40,
          height: 10,
          strokeWidth: 2,
          strokeColor: '#d00000',
          strokeStyle: 'solid',
        },
      },
    ],
  });
};

const createLogoPng = async () => {
  const canvas = createCanvas(120, 60);
  const context = canvas.getContext('2d');

  context.fillStyle = 'rgb(30, 120, 220)';
  context.fillRect(0, 0, 120, 60);

  return await canvas.encode('png');
};

/**
 * Seed an image content, optionally pointing its data at bytes which cannot
 * be loaded.
 */
const seedImageContent = async (envelopeId: string, envelopeItemId: string, options: { broken?: boolean } = {}) => {
  const png = await createLogoPng();

  const dataContent = await createImageDataContent({
    file: {
      name: 'logo.png',
      arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer,
    },
  });

  if (options.broken) {
    // Point the stored data at bytes which are not an image so decoding fails.
    await prisma.dataContent.update({
      where: { id: dataContent.id },
      data: { type: DocumentDataType.BYTES_64, data: Buffer.from('not an image').toString('base64') },
    });
  }

  await prisma.envelopeContent.create({
    data: {
      id: generateDatabaseId('envelope_content'),
      envelopeId,
      envelopeItemId,
      dataContentId: dataContent.id,
      metadata: {
        type: EnvelopeContentType.IMAGE,
        page: 1,
        rotation: 0,
        positionX: 10,
        positionY: 40,
        width: 30,
        height: 10,
      },
    },
  });
};

/**
 * Seed a pending v2 document with no fields, so the signer page renders the
 * contents alone. The seeded fields carry no `fieldMeta`, which the signer
 * renderer rejects, and fields are not what these tests are about.
 */
const seedPendingEnvelopeWithoutFields = async (user: Awaited<ReturnType<typeof seedUser>>['user'], teamId: number) => {
  const document = await seedPendingDocument(user, teamId, [user], { internalVersion: 2 });

  await prisma.field.deleteMany({ where: { envelopeId: document.id } });

  return await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true, recipients: true },
  });
};

const openSigningPage = async (page: Page, email: string, token: string) => {
  await apiSignin({ page, email, redirectPath: `/sign/${token}` });
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
};

test('contents render for the signer without editor guides and with images loaded', async ({ page }) => {
  const { user, team } = await seedUser();

  const envelope = await seedPendingEnvelopeWithoutFields(user, team.id);

  await seedStaticContents(envelope.id, envelope.envelopeItems[0].id);
  await seedImageContent(envelope.id, envelope.envelopeItems[0].id);

  await openSigningPage(page, user.email, envelope.recipients[0].token);
  await expect(getPageCanvas(page)).toBeVisible();

  const groups = await getContentGroupsForPage(page);

  expect(groups).toHaveLength(3);

  for (const group of groups) {
    expect(group.visible).toBe(true);

    // Editor guides never render outside the content editor.
    expect(group.visibleChildren).not.toContain('content-bounds-rect');
    expect(group.visibleChildren).not.toContain('content-placeholder-rect');
    expect(group.visibleChildren).not.toContain('content-hover-outline');
  }

  const image = groups.find((group) => group.contentType === 'image');

  // The image was preloaded and drawn, rather than falling back to a placeholder.
  expect(image?.visibleChildren).toContain('content-image');
});

test('a content image which fails to load shows the render error state to the signer', async ({ page }) => {
  const { user, team } = await seedUser();

  const envelope = await seedPendingEnvelopeWithoutFields(user, team.id);

  await seedImageContent(envelope.id, envelope.envelopeItems[0].id, { broken: true });

  await openSigningPage(page, user.email, envelope.recipients[0].token);

  await expect(page.getByText('Configuration Error')).toBeVisible();
  await expect(getPageCanvas(page)).toHaveCount(0);
});

test('contents are not rendered again on a completed document', async ({ page }) => {
  const { user, team } = await seedUser();

  const document = await seedCompletedDocument(user, team.id, [user], { internalVersion: 2 });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true },
  });

  // Contents on a completed envelope are already imprinted onto its PDF.
  await seedStaticContents(envelope.id, envelope.envelopeItems[0].id);

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents/${document.id}` });

  await expect(getPageCanvas(page)).toBeVisible();

  expect(await getContentGroupsForPage(page)).toHaveLength(0);
});
