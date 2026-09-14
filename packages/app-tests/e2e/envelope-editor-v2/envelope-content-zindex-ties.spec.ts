import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, type Page, test } from '@playwright/test';

import { getContentGroupsForPage, getPageCanvas, selectEditorTab } from '../fixtures/contents';
import { clickEnvelopeEditorStep, openDocumentEnvelopeEditor } from '../fixtures/envelope-editor';

/**
 * Contents sharing a `zIndex` are stacked by their database ID everywhere the
 * document is rendered. The editor has to agree, otherwise what is authored
 * is not what is sealed.
 *
 * Ties cannot be produced through the editor, which always places a content
 * above the rest of its page, so they are seeded directly.
 */

const POSITIONS = [10, 25, 40, 55];

const seedTiedContents = async (envelopeId: string) => {
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: { envelopeItems: true },
  });

  await prisma.envelopeContent.createMany({
    data: POSITIONS.map((positionX) => ({
      id: generateDatabaseId('envelope_content'),
      envelopeId,
      envelopeItemId: envelope.envelopeItems[0].id,
      zIndex: 0,
      metadata: ZEnvelopeContentMetaSchema.parse({
        type: EnvelopeContentType.TEXT,
        page: 1,
        rotation: 0,
        positionX,
        positionY: 20,
        width: 10,
        height: 5,
        text: `x${positionX}`,
      }),
    })),
  });

  const contents = await prisma.envelopeContent.findMany({
    where: { envelopeId },
    select: { id: true, metadata: true },
  });

  // The order every other renderer uses: zIndex, then database ID.
  return [...contents]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((content) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const metadata = content.metadata as { positionX?: number };

      return metadata.positionX;
    });
};

/**
 * The horizontal positions of the page's contents, in the order they are
 * stacked on the canvas.
 */
const getCanvasStackingOrder = async (root: Page) => {
  const groups = await getContentGroupsForPage(root);
  const { width } = await root.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const konva = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    const stage = konva.stages.find((currentStage) => currentStage.attrs.id === 'page-1');

    return { width: (stage?.width() ?? 1) / (stage?.scaleX() ?? 1) };
  });

  return groups.map((group) =>
    POSITIONS.reduce((closest, position) =>
      Math.abs((position / 100) * width - group.rect.x) < Math.abs((closest / 100) * width - group.rect.x)
        ? position
        : closest,
    ),
  );
};

const openContentsTab = async (root: Page) => {
  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(getPageCanvas(root)).toBeVisible();
  await selectEditorTab(root, 'Contents');
};

test('contents sharing a zIndex stack by database ID in the editor', async ({ page }) => {
  const surface = await openDocumentEnvelopeEditor(page);

  const envelopeId = surface.envelopeId;

  if (!envelopeId) {
    throw new Error('Expected the document editor surface to have an envelopeId');
  }

  const expectedOrder = await seedTiedContents(envelopeId);

  // Reloaded repeatedly since the editor's own IDs are regenerated on each
  // load, so a stacking order derived from them would vary between loads.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.reload();
    await openContentsTab(page);

    await expect.poll(async () => (await getContentGroupsForPage(page)).length).toBe(POSITIONS.length);

    expect(await getCanvasStackingOrder(page)).toEqual(expectedOrder);
  }
});
