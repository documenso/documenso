import { createDataContentImage } from '@documenso/lib/server-only/data-content/create-data-content-image';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { createCanvas } from '@napi-rs/canvas';
import { expect, type Page, test } from '@playwright/test';
import { DocumentStatus } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { getPageCanvas } from '../fixtures/contents';

/**
 * A sealed envelope has its contents imprinted on the PDF, so their images
 * are never loaded. The page must still render, otherwise the fields drawn
 * alongside them disappear too.
 */

const seedSealedDocumentWithImageContent = async ({ withImageContent }: { withImageContent: boolean }) => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, [user], { internalVersion: 2 });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true },
  });

  if (withImageContent) {
    const png = await createCanvas(60, 30).encode('png');

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
  }

  // Rejecting seals the envelope, and unlike completing it the fields are
  // still meant to be drawn.
  await prisma.envelope.update({
    where: { id: envelope.id },
    data: { status: DocumentStatus.REJECTED },
  });

  return { user, team, documentId: document.id };
};

const countFieldGroups = async (page: Page) =>
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const konva = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    const stage = konva.stages.find((currentStage) => currentStage.attrs.id === 'page-1');

    return stage?.find('.field-group').length ?? 0;
  });

test('a rejected document with an image content still draws its fields', async ({ page }) => {
  const { user, team, documentId } = await seedSealedDocumentWithImageContent({ withImageContent: true });

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents/${documentId}` });

  await expect(getPageCanvas(page)).toBeVisible();
  await expect.poll(() => countFieldGroups(page)).toBeGreaterThan(0);
});

test('a rejected document without contents is unaffected', async ({ page }) => {
  const { user, team, documentId } = await seedSealedDocumentWithImageContent({ withImageContent: false });

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents/${documentId}` });

  await expect(getPageCanvas(page)).toBeVisible();
  await expect.poll(() => countFieldGroups(page)).toBeGreaterThan(0);
});
