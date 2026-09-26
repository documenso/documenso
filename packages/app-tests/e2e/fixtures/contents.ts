import { expect, type Locator, type Page } from '@playwright/test';
import type Konva from 'konva';

import type { TEnvelopeEditorSurface } from './envelope-editor';
import { getKonvaElementCountForPage } from './konva';

export type ContentButtonName = 'Text' | 'Line' | 'Rectangle' | 'Highlight' | 'Image';

/**
 * Switch the fields step sidebar to the given tab.
 */
export const selectEditorTab = async (root: Page, tab: 'Fields' | 'Contents') => {
  await root.getByRole('tab', { name: tab }).click();
  await expect(root.getByRole('tab', { name: tab })).toHaveAttribute('data-state', 'active');
};

export const getPageCanvas = (root: Page) => root.locator('.konva-container canvas').first();

/**
 * Run a mouse interaction on the canvas with the floating action bar of the
 * current selection unable to intercept it.
 *
 * The bar hangs just below the selected content and sits above the canvas,
 * so a click there would press one of its buttons (e.g. Remove) rather than
 * reach the canvas.
 */
export const interactWithCanvasPastActionBar = async (root: Page, interaction: () => Promise<void>) => {
  const setActionBarPointerEvents = async (value: string) => {
    await root.evaluate((pointerEvents) => {
      for (const bar of document.querySelectorAll<HTMLElement>('[data-testid="envelope-canvas-action-bar"]')) {
        bar.style.pointerEvents = pointerEvents;
      }
    }, value);
  };

  await setActionBarPointerEvents('none');

  try {
    await interaction();
  } finally {
    await setActionBarPointerEvents('');
  }
};

/**
 * Pick a content from the palette and click on the canvas to place it.
 */
export const placeContentOnPdf = async (
  root: Page,
  contentName: ContentButtonName,
  position: { x: number; y: number },
) => {
  await root.getByRole('button', { name: contentName, exact: true }).click();

  const canvas = getPageCanvas(root);
  await expect(canvas).toBeVisible();

  await interactWithCanvasPastActionBar(root, async () => {
    await canvas.click({ position });
  });
};

/**
 * Click a content on the canvas to select it.
 */
export const selectContentOnCanvas = async (
  root: Page,
  position: { x: number; y: number },
  options: { shift?: boolean } = {},
) => {
  const canvas = getPageCanvas(root);
  await expect(canvas).toBeVisible();
  await root.waitForTimeout(300);

  await interactWithCanvasPastActionBar(root, async () => {
    await canvas.click({ position, modifiers: options.shift ? ['Shift'] : [], force: true });
  });
};

export const getContentCountForPage = async (root: Page, pageNumber = 1) =>
  await getKonvaElementCountForPage(root, pageNumber, '.content-group');

export const getFieldCountForPage = async (root: Page, pageNumber = 1) =>
  await getKonvaElementCountForPage(root, pageNumber, '.field-group');

type ContentGroupSnapshot = {
  id: string;
  contentType: string | undefined;
  visible: boolean;
  /**
   * The group's client rect in unscaled page coordinates.
   */
  rect: { x: number; y: number; width: number; height: number };
  /**
   * The names of the group's visible child nodes.
   */
  visibleChildren: string[];
};

/**
 * Snapshot every content group on a page, straight from Konva.
 */
export const getContentGroupsForPage = async (root: Page, pageNumber = 1): Promise<ContentGroupSnapshot[]> => {
  await getPageCanvas(root).waitFor({ state: 'visible' });

  return await root.evaluate(
    ({ pageNumber }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((currentStage) => currentStage.attrs.id === `page-${pageNumber}`);

      if (!stage) {
        return [];
      }

      const scale = stage.scaleX();

      return stage.find('.content-group').map((node) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const group = node as Konva.Group;
        const rect = group.getClientRect({ skipStroke: true, skipShadow: true });

        return {
          id: group.id(),
          contentType: group.getAttr('contentType'),
          visible: group.isVisible(),
          rect: { x: rect.x / scale, y: rect.y / scale, width: rect.width / scale, height: rect.height / scale },
          visibleChildren: group
            .getChildren()
            .filter((child) => child.isVisible())
            .map((child) => child.name()),
        };
      });
    },
    { pageNumber },
  );
};

/**
 * The unscaled page size of a page's Konva stage.
 */
export const getPageSize = async (root: Page, pageNumber = 1) => {
  await getPageCanvas(root).waitFor({ state: 'visible' });

  return await root.evaluate(
    ({ pageNumber }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((currentStage) => currentStage.attrs.id === `page-${pageNumber}`);

      if (!stage) {
        throw new Error(`Stage for page ${pageNumber} not found`);
      }

      return { width: stage.width() / stage.scaleX(), height: stage.height() / stage.scaleY(), scale: stage.scaleX() };
    },
    { pageNumber },
  );
};

/**
 * Wait until exactly the given contents are selected, i.e. the transformer is
 * attached to them and their anchors can be grabbed.
 */
export const waitForContentSelection = async (root: Page, contentIds: string[], pageNumber = 1) => {
  await expect
    .poll(
      async () =>
        await root.evaluate(
          ({ pageNumber }) => {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

            const stage = konva.stages.find((currentStage) => currentStage.attrs.id === `page-${pageNumber}`);

            if (!stage) {
              return [];
            }

            return stage
              .find('Transformer')
              .flatMap((node) =>
                node instanceof konva.Transformer ? node.nodes().map((selected) => selected.id()) : [],
              )
              .sort();
          },
          { pageNumber },
        ),
    )
    .toEqual([...contentIds].sort());
};

/**
 * Open the settings dialog and set the external ID used to find the envelope
 * in the database.
 */
export const getContentActionButton = (root: Page, title: string): Locator =>
  root.getByTestId('envelope-canvas-action-bar').locator(`button[title="${title}"]`);

/**
 * Wait for the editor's debounced autosave to flush.
 */
export const waitForContentsAutosave = async (surface: TEnvelopeEditorSurface) => {
  if (surface.isEmbedded) {
    return;
  }

  // Autosave debounces for 2 seconds.
  await surface.root.waitForTimeout(2500);
};
