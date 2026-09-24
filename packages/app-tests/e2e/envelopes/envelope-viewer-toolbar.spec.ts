import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';
import { getPageCanvas } from '../fixtures/contents';

/**
 * The viewer toolbar is positioned against the visible area of the scroll
 * container, which can change size without the window doing so (e.g. the
 * signing view's collapsible sidebar).
 */

const SIDEBAR_EXPANDED_WIDTH = 320;
const SIDEBAR_COLLAPSED_WIDTH = 48;

/**
 * The horizontal centre of the toolbar and of the scroll container it belongs
 * to. They must stay aligned.
 */
const getToolbarAndContainerCentres = async (page: Page) =>
  await page.evaluate(() => {
    const zoomOut = document.querySelector('button[title="Zoom out"]');
    const toolbar = zoomOut?.parentElement;
    const scroller = document.querySelector('.embed--DocumentContainer');

    if (!toolbar || !scroller) {
      throw new Error('Toolbar or scroll container not found');
    }

    const toolbarRect = toolbar.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();

    return {
      toolbar: toolbarRect.left + toolbarRect.width / 2,
      container: scrollerRect.left + scrollerRect.width / 2,
      containerWidth: scrollerRect.width,
    };
  });

test('the viewer toolbar follows the scroll container when the sidebar collapses', async ({ page }) => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, [user], { internalVersion: 2 });

  // The seeded fields carry no `fieldMeta`, which the v2 signer rejects, and
  // fields are not what this test is about.
  await prisma.field.deleteMany({ where: { envelopeId: document.id } });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { recipients: true },
  });

  // The scroll container is observed from within the observer's own callback,
  // so a mistake there surfaces as a resize loop.
  const consoleErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  // The toolbar is only shown from the `lg` breakpoint on the signing view.
  await page.setViewportSize({ width: 1400, height: 900 });

  await apiSignin({ page, email: user.email, redirectPath: `/sign/${envelope.recipients[0].token}` });
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
  await expect(getPageCanvas(page)).toBeVisible();

  const collapseButton = page.getByRole('button', { name: 'Collapse sidebar' });
  await expect(collapseButton).toBeVisible();

  const expanded = await getToolbarAndContainerCentres(page);

  expect(expanded.toolbar).toBeCloseTo(expanded.container, 0);

  await collapseButton.click();

  // The container widens by the difference in sidebar widths, so its centre
  // shifts left by half of that.
  await expect
    .poll(async () => (await getToolbarAndContainerCentres(page)).containerWidth)
    .toBeGreaterThan(expanded.containerWidth + (SIDEBAR_EXPANDED_WIDTH - SIDEBAR_COLLAPSED_WIDTH) / 2);

  await expect
    .poll(async () => {
      const { toolbar, container } = await getToolbarAndContainerCentres(page);

      return Math.abs(toolbar - container);
    })
    .toBeLessThan(1);

  // And it tracks the container back the other way.
  await page.getByRole('button', { name: 'Expand sidebar' }).click();

  await expect
    .poll(async () => (await getToolbarAndContainerCentres(page)).containerWidth)
    .toBeLessThan(expanded.containerWidth + 1);

  await expect
    .poll(async () => {
      const { toolbar, container } = await getToolbarAndContainerCentres(page);

      return Math.abs(toolbar - container);
    })
    .toBeLessThan(1);

  expect(consoleErrors.filter((error) => error.includes('ResizeObserver'))).toEqual([]);
});
