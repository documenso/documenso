import { createDataContentImage } from '@documenso/lib/server-only/data-content/create-data-content-image';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from '@playwright/test';

import { getContentGroupsForPage } from '../fixtures/contents';

/**
 * An image content with no image renders nothing, so a direct template
 * holding one would let a signer fill everything in and only fail when the
 * document is created. The signing page reports it up front instead.
 */

const INVALID_TEMPLATE_HEADING = 'Invalid direct link template';

/**
 * A real PNG, encoded the same way as an uploaded one, so the browser can
 * actually decode it when the signing page loads the image.
 */
const createPng = async () => {
  const canvas = createCanvas(60, 30);
  const context = canvas.getContext('2d');

  context.fillStyle = 'rgb(30, 120, 220)';
  context.fillRect(0, 0, 60, 30);

  return await canvas.encode('png');
};

const seedDirectTemplateWithImageContent = async ({ withImage }: { withImage: boolean }) => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    title: `E2E Direct Template Missing Image ${Date.now()}`,
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
    createDirectRecipientSignatureField: true,
  });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: template.id },
    include: { envelopeItems: true, directLink: true },
  });

  let dataContentId: string | null = null;

  if (withImage) {
    const png = await createPng();

    const dataContent = await createDataContentImage({
      file: { name: 'image.png', arrayBuffer: async () => png.buffer as ArrayBuffer },
    });

    dataContentId = dataContent.id;
  }

  await prisma.envelopeContent.create({
    data: {
      id: generateDatabaseId('envelope_content'),
      envelopeId: envelope.id,
      envelopeItemId: envelope.envelopeItems[0].id,
      dataContentId,
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

  if (!envelope.directLink) {
    throw new Error('Direct link not seeded');
  }

  return { token: envelope.directLink.token };
};

test('the direct signing page reports an image content with no image', async ({ page }) => {
  const { token } = await seedDirectTemplateWithImageContent({ withImage: false });

  await page.goto(`/d/${token}`);

  await expect(page.getByRole('heading', { name: INVALID_TEMPLATE_HEADING })).toBeVisible();
  await expect(page.getByText('image content')).toBeVisible();

  // The signing form is not offered at all.
  await expect(page.getByRole('button', { name: 'Complete' })).toHaveCount(0);
});

test('the direct signing page still reports a signer with no signature field', async ({ page }) => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    title: `E2E Direct Template Missing Signature ${Date.now()}`,
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
    createDirectRecipientSignatureField: false,
  });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: template.id },
    include: { directLink: true },
  });

  if (!envelope.directLink) {
    throw new Error('Direct link not seeded');
  }

  await page.goto(`/d/${envelope.directLink.token}`);

  await expect(page.getByRole('heading', { name: INVALID_TEMPLATE_HEADING })).toBeVisible();
  await expect(page.getByText('do not have a signature field assigned')).toBeVisible();
});

/**
 * A direct template is signed as-is, before any document exists, so its
 * contents are not yet inserted into the PDF. The signer must still see them,
 * which means they are drawn on the canvas here rather than read from the
 * bytes as they are for a sent document.
 */
test('the direct signing page draws the contents once the image is attached', async ({ page }) => {
  const { token } = await seedDirectTemplateWithImageContent({ withImage: true });

  await page.goto(`/d/${token}`);

  await expect(page.getByRole('heading', { name: INVALID_TEMPLATE_HEADING })).toHaveCount(0);
  await expect(page.locator('.konva-container canvas').first()).toBeVisible();

  // The image decodes asynchronously, so poll until the group has drawn it.
  await expect
    .poll(async () => {
      const groups = await getContentGroupsForPage(page);

      return groups.map((group) => ({
        type: group.contentType,
        hasImage: group.visibleChildren.includes('content-image'),
      }));
    })
    .toEqual([{ type: EnvelopeContentType.IMAGE, hasImage: true }]);
});
