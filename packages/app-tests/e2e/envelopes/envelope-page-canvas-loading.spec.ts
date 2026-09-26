import { createDataContentImage } from '@documenso/lib/server-only/data-content/create-data-content-image';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

/**
 * A page and everything drawn on it appear together. The page image is held
 * back until the content images are loaded too, so a page is never shown in a
 * half drawn state.
 */

const IMAGE_LOAD_MS = 4000;

test('a page waiting on its content images shows a loader', async ({ page }) => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, [user], { internalVersion: 2 });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true, recipients: true },
  });

  // The seeded fields carry no `fieldMeta`, which the v2 signer rejects.
  await prisma.field.deleteMany({ where: { envelopeId: envelope.id } });

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

  await page.route('**/dataContent/**/image', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, IMAGE_LOAD_MS));

    await route.continue();
  });

  await apiSignin({ page, email: user.email, redirectPath: `/sign/${envelope.recipients[0].token}` });

  const pageLoader = page.getByTestId('page-loader').first();
  const pageImage = page.locator('img[alt=""]').first();

  // While the content image is on its way, neither the page nor its contents
  // are shown.
  await expect(pageLoader).toBeVisible();
  await expect(pageImage).not.toBeVisible();
  await expect(page.locator('.konva-container canvas')).toHaveCount(0);

  // Once it lands they appear together.
  await expect(pageImage).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.konva-container canvas').first()).toBeVisible();
  await expect(pageLoader).toHaveCount(0);
});

test('a page with no content images renders as soon as the page image is ready', async ({ page }) => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, [user], { internalVersion: 2 });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { recipients: true },
  });

  await prisma.field.deleteMany({ where: { envelopeId: envelope.id } });

  await apiSignin({ page, email: user.email, redirectPath: `/sign/${envelope.recipients[0].token}` });

  await expect(page.locator('.konva-container canvas').first()).toBeVisible();
  await expect(page.locator('img[alt=""]').first()).toBeVisible();
  await expect(page.getByTestId('page-loader')).toHaveCount(0);
});
