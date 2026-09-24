import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';
import {
  getContentActionButton,
  getContentCountForPage,
  getContentGroupsForPage,
  getFieldCountForPage,
  getPageCanvas,
  getPageSize,
  interactWithCanvasPastActionBar,
  placeContentOnPdf,
  selectContentOnCanvas,
  selectEditorTab,
  waitForContentSelection,
  waitForContentsAutosave,
} from '../fixtures/contents';
import {
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';
import { getKonvaTransformerNodeCountForPage } from '../fixtures/konva';

/**
 * Contents are only authored on the native document and template surfaces.
 * The embedded editor persists through the public envelope API, which does
 * not carry contents yet, so the tab is hidden there (see the embedded test).
 */

const openSettingsDialog = async (root: Page) => {
  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
};

const updateExternalId = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await openSettingsDialog(surface.root);
  await surface.root.locator('input[name="externalId"]').fill(externalId);
  await surface.root.getByRole('button', { name: 'Update' }).click();
  await expectToastTextToBeVisible(surface.root, 'Envelope updated');
  await surface.root.getByTestId('toast-close').click();
};

/**
 * Set up the editor on the fields step with the contents tab open.
 */
const openContentsTab = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await updateExternalId(surface, externalId);
  await clickAddMyselfButton(surface.root);

  await clickEnvelopeEditorStep(surface.root, 'addFields');
  await expect(getPageCanvas(surface.root)).toBeVisible();

  await selectEditorTab(surface.root, 'Contents');
  await expect(surface.root.getByRole('heading', { name: 'Add Content' })).toBeVisible();
};

const findEnvelopeWithContents = async (surface: TEnvelopeEditorSurface, externalId: string) =>
  await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      contents: {
        include: {
          dataContent: true,
        },
      },
    },
  });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getMeta = (metadata: unknown): Record<string, unknown> => {
  if (!isRecord(metadata)) {
    throw new Error('Content meta is not an object');
  }

  return metadata;
};

// --- Place and persist one of each content type ---

const runPlaceAllContentTypesFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-contents-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  await placeContentOnPdf(root, 'Text', { x: 120, y: 120 });
  await placeContentOnPdf(root, 'Line', { x: 320, y: 120 });
  await placeContentOnPdf(root, 'Rectangle', { x: 120, y: 260 });
  await placeContentOnPdf(root, 'Highlight', { x: 320, y: 260 });
  await placeContentOnPdf(root, 'Image', { x: 120, y: 420 });

  expect(await getContentCountForPage(root)).toBe(5);

  await waitForContentsAutosave(surface);

  // Navigate away and back to verify the contents are reloaded.
  await clickEnvelopeEditorStep(root, 'upload');
  await expect(root.getByRole('heading', { name: 'Recipients' })).toBeVisible();

  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(getPageCanvas(root)).toBeVisible();
  await selectEditorTab(root, 'Contents');

  expect(await getContentCountForPage(root)).toBe(5);

  return { externalId };
};

const assertAllContentTypesPersisted = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  const envelope = await findEnvelopeWithContents(surface, externalId);

  expect(envelope.contents).toHaveLength(5);

  const types = envelope.contents.map((content) => getMeta(content.contentMeta).type).sort();

  expect(types).toEqual(['highlight', 'image', 'line', 'shape', 'text']);

  const shape = envelope.contents.find((content) => getMeta(content.contentMeta).type === 'shape');

  expect(getMeta(shape?.contentMeta).shape).toBe('rectangle');

  for (const content of envelope.contents) {
    const meta = getMeta(content.contentMeta);

    expect(meta.page).toBe(1);

    if (meta.type === 'line') {
      for (const key of ['x1', 'x2', 'y1', 'y2']) {
        expect(meta[key]).toBeGreaterThanOrEqual(0);
        expect(meta[key]).toBeLessThanOrEqual(100);
      }
    } else {
      expect(Number(meta.positionX) + Number(meta.width)).toBeLessThanOrEqual(100);
      expect(Number(meta.positionY) + Number(meta.height)).toBeLessThanOrEqual(100);
    }
  }
};

// --- Edit settings via the sidebar ---

const SIDEBAR_VALUES = {
  text: 'Edited from the sidebar',
  fontSize: '18',
  strokeWidth: '3',
};

const runSidebarSettingsFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-contents-sidebar-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  // Text: the content stays selected after being placed.
  await placeContentOnPdf(root, 'Text', { x: 150, y: 150 });
  await expect(root.getByRole('heading', { name: 'Text Settings' })).toBeVisible();

  await root.getByTestId('content-form-text').fill(SIDEBAR_VALUES.text);
  await root.getByTestId('field-form-fontSize').fill(SIDEBAR_VALUES.fontSize);

  await root.getByTestId('field-form-textAlign').click();
  await root.getByRole('option', { name: 'Center' }).click();

  // Line.
  await placeContentOnPdf(root, 'Line', { x: 300, y: 300 });
  await expect(root.getByRole('heading', { name: 'Line Settings' })).toBeVisible();

  await root.getByTestId('content-form-strokeWidth').fill(SIDEBAR_VALUES.strokeWidth);
  await root.getByTestId('content-form-strokeStyle').click();
  await root.getByRole('option', { name: 'Dashed' }).click();

  // Rectangle: enable the fill.
  await placeContentOnPdf(root, 'Rectangle', { x: 150, y: 450 });
  await expect(root.getByRole('heading', { name: 'Shape Settings' })).toBeVisible();

  await root.getByTestId('content-form-fill').click();
  await expect(root.getByText('Fill Color')).toBeVisible();

  await waitForContentsAutosave(surface);

  return { externalId };
};

const assertSidebarSettingsPersisted = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  const envelope = await findEnvelopeWithContents(surface, externalId);

  const text = envelope.contents.find((content) => getMeta(content.contentMeta).type === 'text');
  const line = envelope.contents.find((content) => getMeta(content.contentMeta).type === 'line');
  const shape = envelope.contents.find((content) => getMeta(content.contentMeta).type === 'shape');

  expect(getMeta(text?.contentMeta)).toMatchObject({
    text: SIDEBAR_VALUES.text,
    fontSize: Number(SIDEBAR_VALUES.fontSize),
    textAlign: 'center',
  });

  expect(getMeta(line?.contentMeta)).toMatchObject({
    strokeWidth: Number(SIDEBAR_VALUES.strokeWidth),
    strokeStyle: 'dashed',
  });

  expect(typeof getMeta(shape?.contentMeta).fillColor).toBe('string');
};

// --- Edit styles via the floating action bar ---

const ACTION_BAR_VALUES = {
  textColor: '#ff0000',
  borderColor: '#0000ff',
};

/**
 * Open a color action from the bar and type a hex value into its picker.
 */
const setActionBarColor = async (root: Page, title: string, hex: string) => {
  await getContentActionButton(root, title).click();

  const hexInput = root.locator('[role="dialog"] input, [data-radix-popper-content-wrapper] input').last();

  await expect(hexInput).toBeVisible();
  await hexInput.fill(hex.replace('#', ''));
  await hexInput.press('Enter');

  await root.keyboard.press('Escape');
};

const runActionBarStylesFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-contents-bar-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  await placeContentOnPdf(root, 'Text', { x: 150, y: 150 });
  await expect(getContentActionButton(root, 'Text color')).toBeVisible();

  await setActionBarColor(root, 'Text color', ACTION_BAR_VALUES.textColor);

  await getContentActionButton(root, 'Text align').click();
  await root.getByRole('button', { name: 'Right', exact: true }).click();
  await root.keyboard.press('Escape');

  await getContentActionButton(root, 'Vertical align').click();
  await root.getByRole('button', { name: 'Bottom', exact: true }).click();
  await root.keyboard.press('Escape');

  // The sidebar reflects the bar's changes.
  await expect(root.getByText(ACTION_BAR_VALUES.textColor.toUpperCase())).toBeVisible();
  await expect(root.getByTestId('field-form-textAlign')).toContainText('Right');

  await placeContentOnPdf(root, 'Rectangle', { x: 150, y: 400 });
  await expect(getContentActionButton(root, 'Border color')).toBeVisible();

  await setActionBarColor(root, 'Border color', ACTION_BAR_VALUES.borderColor);

  // Only single selections get style actions.
  await selectContentOnCanvas(root, { x: 150, y: 150 }, { shift: true });
  expect(await getKonvaTransformerNodeCountForPage(root, 1)).toBe(2);
  await expect(getContentActionButton(root, 'Text color')).toHaveCount(0);
  await expect(getContentActionButton(root, 'Border color')).toHaveCount(0);
  await expect(getContentActionButton(root, 'Duplicate')).toBeVisible();

  await waitForContentsAutosave(surface);

  return { externalId };
};

const assertActionBarStylesPersisted = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  const envelope = await findEnvelopeWithContents(surface, externalId);

  const text = envelope.contents.find((content) => getMeta(content.contentMeta).type === 'text');
  const shape = envelope.contents.find((content) => getMeta(content.contentMeta).type === 'shape');

  expect(getMeta(text?.contentMeta)).toMatchObject({
    color: ACTION_BAR_VALUES.textColor,
    textAlign: 'right',
    verticalAlign: 'bottom',
  });

  expect(getMeta(shape?.contentMeta)).toMatchObject({
    strokeColor: ACTION_BAR_VALUES.borderColor,
  });
};

// --- Duplicate and remove via the action bar ---

const runDuplicateAndRemoveFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-contents-actions-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  await placeContentOnPdf(root, 'Rectangle', { x: 150, y: 150 });
  expect(await getContentCountForPage(root)).toBe(1);

  const [original] = await getContentGroupsForPage(root);

  await getContentActionButton(root, 'Duplicate').click();
  expect(await getContentCountForPage(root)).toBe(2);

  // The duplicate is offset from the original so it does not fully overlap.
  const groups = await getContentGroupsForPage(root);
  const duplicate = groups.find((group) => group.id !== original.id);

  expect(duplicate).toBeDefined();
  expect(duplicate?.rect.x).toBeGreaterThan(original.rect.x);
  expect(duplicate?.rect.y).toBeGreaterThan(original.rect.y);

  await waitForContentsAutosave(surface);

  const afterDuplicate = await findEnvelopeWithContents(surface, externalId);

  expect(afterDuplicate.contents).toHaveLength(2);

  // Multi-select both via shift click and remove them together. The
  // duplicate is offset down and right of the original and overlaps it, so
  // each is clicked where only it is. Points sit at the top edge of their
  // box: the selected content's floating action bar hangs just below its
  // bottom edge, and a click near there would hit the bar's buttons instead.
  const { scale } = await getPageSize(root);

  if (!duplicate) {
    throw new Error('Duplicate not found');
  }

  const duplicateOnly = {
    x: (duplicate.rect.x + duplicate.rect.width - 4) * scale,
    y: (duplicate.rect.y + 4) * scale,
  };

  const originalOnly = {
    x: (original.rect.x + 4) * scale,
    y: (original.rect.y + 4) * scale,
  };

  await selectContentOnCanvas(root, duplicateOnly);
  await selectContentOnCanvas(root, originalOnly, { shift: true });
  expect(await getKonvaTransformerNodeCountForPage(root, 1)).toBe(2);

  await getContentActionButton(root, 'Remove').click();
  expect(await getContentCountForPage(root)).toBe(0);

  await waitForContentsAutosave(surface);

  return { externalId };
};

const assertContentsRemoved = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  const envelope = await findEnvelopeWithContents(surface, externalId);

  expect(envelope.contents).toHaveLength(0);
};

// --- Fields auto hide on the contents tab ---

const runFieldsAutoHideFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-contents-hide-${nanoid()}`;
  const root = surface.root;

  await updateExternalId(surface, externalId);
  await clickAddMyselfButton(root);

  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(getPageCanvas(root)).toBeVisible();

  await root.getByRole('button', { name: 'Signature', exact: true }).click();
  await getPageCanvas(root).click({ position: { x: 150, y: 150 } });
  expect(await getFieldCountForPage(root)).toBe(1);

  /**
   * Whether every field group on the page satisfies the given Konva check.
   */
  const everyFieldGroup = async (check: 'isVisible' | 'isListening') => {
    const results = await root.evaluate(
      ({ check }) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const konva = (window as unknown as { Konva: typeof import('konva').default }).Konva;
        const stage = konva.stages.find((currentStage) => currentStage.attrs.id === 'page-1');

        return stage?.find('.field-group').map((node) => node[check]()) ?? [];
      },
      { check },
    );

    return results.length > 0 && results.every(Boolean);
  };

  expect(await everyFieldGroup('isVisible')).toBe(true);

  await selectEditorTab(root, 'Contents');
  expect(await everyFieldGroup('isVisible')).toBe(false);
  await expect(root.locator('button[title="Show fields"]')).toBeVisible();

  await selectEditorTab(root, 'Fields');
  expect(await everyFieldGroup('isVisible')).toBe(true);
  await expect(root.locator('button[title="Hide fields"]')).toBeVisible();

  // Showing the fields from the toolbar while on the contents tab mutes them
  // (visible but not interactive). Hiding them again and returning to the
  // fields tab must hand the interactivity back.
  await selectEditorTab(root, 'Contents');
  await root.locator('button[title="Show fields"]').click();
  await expect(root.locator('button[title="Hide fields"]')).toBeVisible();
  expect(await everyFieldGroup('isListening')).toBe(false);

  await root.locator('button[title="Hide fields"]').click();
  await expect(root.locator('button[title="Show fields"]')).toBeVisible();

  await selectEditorTab(root, 'Fields');
  expect(await everyFieldGroup('isVisible')).toBe(true);
  expect(await everyFieldGroup('isListening')).toBe(true);

  // Hiding the contents from the toolbar is an override for the current tab
  // only. Switching tabs in either direction resets contents to visible.
  await root.locator('button[title="Hide contents"]').click();
  await expect(root.locator('button[title="Show contents"]')).toBeVisible();

  await selectEditorTab(root, 'Contents');
  await expect(root.locator('button[title="Hide contents"]')).toBeVisible();

  await root.locator('button[title="Hide contents"]').click();
  await expect(root.locator('button[title="Show contents"]')).toBeVisible();

  await selectEditorTab(root, 'Fields');
  await expect(root.locator('button[title="Hide contents"]')).toBeVisible();
  await expect(root.locator('button[title="Hide fields"]')).toBeVisible();

  // And the field can actually be selected by clicking it.
  const fieldRect = await root.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const konva = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    const stage = konva.stages.find((currentStage) => currentStage.attrs.id === 'page-1');
    const group = stage?.findOne('.field-group');

    if (!stage || !group) {
      throw new Error('Field group not found');
    }

    const rect = group.getClientRect();

    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });

  await getPageCanvas(root).click({ position: fieldRect });
  await expect.poll(() => getKonvaTransformerNodeCountForPage(root, 1)).toBe(1);
};

// --- Resize is pinned to the page ---

const runResizePinnedToPageFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-contents-resize-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  await placeContentOnPdf(root, 'Rectangle', { x: 200, y: 200 });

  const canvas = getPageCanvas(root);
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Canvas bounding box not available');
  }

  const [group] = await getContentGroupsForPage(root);
  const { scale } = await getPageSize(root);

  // The anchors only exist once the placed content is selected.
  await waitForContentSelection(root, [group.id]);

  // Grab the bottom right anchor and drag it well past the page's bottom
  // right corner. The mouse leaves the page, the box must not.
  const anchorX = box.x + (group.rect.x + group.rect.width) * scale;
  const anchorY = box.y + (group.rect.y + group.rect.height) * scale;

  await interactWithCanvasPastActionBar(root, async () => {
    await root.mouse.move(anchorX, anchorY);
    await root.mouse.down();
    await root.mouse.move(box.x + box.width + 200, box.y + box.height + 200, { steps: 10 });
    await root.mouse.up();
  });

  await waitForContentsAutosave(surface);

  return { externalId };
};

const assertResizePinnedToPage = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  const envelope = await findEnvelopeWithContents(surface, externalId);

  expect(envelope.contents).toHaveLength(1);

  const meta = getMeta(envelope.contents[0].contentMeta);

  // The box grew in both directions and stopped at the page edges. The pixel
  // to percent conversion leaves floating point noise, hence the tolerance.
  expect(Number(meta.positionX) + Number(meta.width)).toBeCloseTo(100, 3);
  expect(Number(meta.positionY) + Number(meta.height)).toBeCloseTo(100, 3);
};

// --- Selecting brings to front ---

const runSelectBringsToFrontFlow = async (surface: TEnvelopeEditorSurface) => {
  const externalId = `e2e-contents-zindex-${nanoid()}`;
  const root = surface.root;

  await openContentsTab(surface, externalId);

  // Two overlapping rectangles. The second is created on top.
  await placeContentOnPdf(root, 'Rectangle', { x: 200, y: 200 });
  await placeContentOnPdf(root, 'Rectangle', { x: 230, y: 220 });

  const [first, second] = await getContentGroupsForPage(root);

  // Konva renders children in order, so the later child is on top.
  const orderAfterPlacing = await getContentGroupOrder(root);

  expect(orderAfterPlacing.indexOf(second.id)).toBeGreaterThan(orderAfterPlacing.indexOf(first.id));

  // Select the first where the second does not cover it: it comes to the front.
  const { scale } = await getPageSize(root);

  await selectContentOnCanvas(root, { x: (first.rect.x + 4) * scale, y: (first.rect.y + 4) * scale });

  const orderAfterSelecting = await getContentGroupOrder(root);

  expect(orderAfterSelecting.indexOf(first.id)).toBeGreaterThan(orderAfterSelecting.indexOf(second.id));

  await waitForContentsAutosave(surface);

  return { externalId };
};

/**
 * The content group ids of a page in their current Konva child order.
 */
const getContentGroupOrder = async (root: Page) => (await getContentGroupsForPage(root)).map((group) => group.id);

const assertSelectedContentPersistedOnTop = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  const envelope = await findEnvelopeWithContents(surface, externalId);

  expect(envelope.contents).toHaveLength(2);

  // The first rectangle was placed further left, so it is the one at the
  // smaller x. Having been selected, it must now be above the second.
  const [first, second] = [...envelope.contents].sort(
    (a, b) => Number(getMeta(a.contentMeta).positionX) - Number(getMeta(b.contentMeta).positionX),
  );

  expect(first.contentMeta.zIndex).toBeGreaterThan(second.contentMeta.zIndex);
};

// --- Tests ---

test.describe('document editor', () => {
  test('place and persist one of each content type', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { externalId } = await runPlaceAllContentTypesFlow(surface);

    await assertAllContentTypesPersisted(surface, externalId);
  });

  test('edit content settings via the sidebar', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { externalId } = await runSidebarSettingsFlow(surface);

    await assertSidebarSettingsPersisted(surface, externalId);
  });

  test('edit content styles via the canvas action bar', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { externalId } = await runActionBarStylesFlow(surface);

    await assertActionBarStylesPersisted(surface, externalId);
  });

  test('duplicate and remove contents via the canvas action bar', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { externalId } = await runDuplicateAndRemoveFlow(surface);

    await assertContentsRemoved(surface, externalId);
  });

  test('fields are hidden while the contents tab is active', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await runFieldsAutoHideFlow(surface);
  });

  test('resizing a content is pinned to the page bounds', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { externalId } = await runResizePinnedToPageFlow(surface);

    await assertResizePinnedToPage(surface, externalId);
  });

  test('selecting a content brings it to the front', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { externalId } = await runSelectBringsToFrontFlow(surface);

    await assertSelectedContentPersistedOnTop(surface, externalId);
  });

  test('contents cannot be added once the document has been sent', async ({ page }) => {
    const { user, team } = await seedUser();

    const document = await seedPendingDocument(user, team.id, [user], { internalVersion: 2 });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit?step=addFields`,
    });

    await expect(getPageCanvas(page)).toBeVisible();
    await selectEditorTab(page, 'Contents');

    await expect(page.getByRole('alert').filter({ hasText: 'Content cannot be changed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rectangle', exact: true })).toHaveCount(0);
  });
});

test.describe('template editor', () => {
  test('place and persist one of each content type', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const { externalId } = await runPlaceAllContentTypesFlow(surface);

    await assertAllContentTypesPersisted(surface, externalId);
  });

  test('edit content settings via the sidebar', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const { externalId } = await runSidebarSettingsFlow(surface);

    await assertSidebarSettingsPersisted(surface, externalId);
  });

  test('edit content styles via the canvas action bar', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const { externalId } = await runActionBarStylesFlow(surface);

    await assertActionBarStylesPersisted(surface, externalId);
  });

  test('duplicate and remove contents via the canvas action bar', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const { externalId } = await runDuplicateAndRemoveFlow(surface);

    await assertContentsRemoved(surface, externalId);
  });

  test('fields are hidden while the contents tab is active', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    await runFieldsAutoHideFlow(surface);
  });

  test('resizing a content is pinned to the page bounds', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const { externalId } = await runResizePinnedToPageFlow(surface);

    await assertResizePinnedToPage(surface, externalId);
  });
});

test.describe('embedded editor', () => {
  test('contents tab is not available', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-contents',
    });

    await clickEnvelopeEditorStep(surface.root, 'addFields');
    await expect(getPageCanvas(surface.root)).toBeVisible();

    await expect(surface.root.getByRole('tab', { name: 'Contents' })).toHaveCount(0);
    await expect(surface.root.getByRole('button', { name: 'Rectangle', exact: true })).toHaveCount(0);
  });
});
