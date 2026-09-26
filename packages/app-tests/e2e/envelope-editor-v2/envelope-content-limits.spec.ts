import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, type Page, test } from '@playwright/test';

import {
  getContentActionButton,
  getContentCountForPage,
  getContentGroupsForPage,
  getPageCanvas,
  getPageSize,
  placeContentOnPdf,
  selectContentOnCanvas,
  selectEditorTab,
} from '../fixtures/contents';
import {
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

/**
 * The organisation's plan caps how many contents (and how many image
 * contents) an envelope may hold. Reaching a limit hides the palette and the
 * duplicate action, while existing contents stay editable and removable.
 */

const setOrganisationContentLimits = async (
  teamId: number,
  limits: { envelopeContentCount?: number; envelopeContentImageCount?: number },
) => {
  const team = await prisma.team.findFirstOrThrow({ where: { id: teamId } });

  const organisationClaim = await prisma.organisationClaim.findFirstOrThrow({
    where: { organisation: { id: team.organisationId } },
  });

  await prisma.organisationClaim.update({
    where: { id: organisationClaim.id },
    data: limits,
  });
};

/**
 * Open the editor for an organisation with the given content allowances.
 *
 * The claim is read from the organisation session, which is loaded when the
 * app boots, so the limits are applied before the editor is reloaded.
 */
const openEditorWithContentLimits = async (
  page: Page,
  limits: { envelopeContentCount?: number; envelopeContentImageCount?: number },
) => {
  const surface = await openDocumentEnvelopeEditor(page);

  await setOrganisationContentLimits(surface.teamId, limits);

  await page.reload();

  return surface;
};

const openContentsTab = async (surface: TEnvelopeEditorSurface) => {
  const root = surface.root;

  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
  await root.locator('input[name="externalId"]').fill(`e2e-content-limit-${nanoid()}`);
  await root.getByRole('button', { name: 'Update' }).click();
  await expectToastTextToBeVisible(root, 'Envelope updated');
  await root.getByTestId('toast-close').click();

  await clickAddMyselfButton(root);

  await clickEnvelopeEditorStep(root, 'addFields');
  await expect(getPageCanvas(root)).toBeVisible();

  await selectEditorTab(root, 'Contents');
};

const getLimitAlert = (root: Page) => root.getByTestId('content-limit-reached-alert');

const getPaletteButton = (root: Page, name: string) => root.getByRole('button', { name, exact: true });

test('content palette is hidden once the content limit is reached', async ({ page }) => {
  const surface = await openEditorWithContentLimits(page, { envelopeContentCount: 2 });
  const root = surface.root;

  await openContentsTab(surface);

  // Under the limit the palette is available.
  await expect(getPaletteButton(root, 'Text')).toBeVisible();
  await expect(getLimitAlert(root)).toHaveCount(0);

  await placeContentOnPdf(root, 'Text', { x: 120, y: 120 });
  await expect.poll(() => getContentCountForPage(root)).toBe(1);
  await expect(getPaletteButton(root, 'Text')).toBeVisible();

  // Reaching the limit replaces the whole palette with the message.
  await placeContentOnPdf(root, 'Text', { x: 120, y: 220 });
  await expect.poll(() => getContentCountForPage(root)).toBe(2);

  await expect(getLimitAlert(root)).toBeVisible();
  await expect(getLimitAlert(root)).toContainText('cannot have more than 2 contents');
  await expect(getPaletteButton(root, 'Text')).toHaveCount(0);
  await expect(getPaletteButton(root, 'Rectangle')).toHaveCount(0);
});

test('duplicate is hidden at the limit and existing contents stay removable', async ({ page }) => {
  const surface = await openEditorWithContentLimits(page, { envelopeContentCount: 1 });
  const root = surface.root;

  await openContentsTab(surface);

  await placeContentOnPdf(root, 'Text', { x: 120, y: 120 });
  await expect.poll(() => getContentCountForPage(root)).toBe(1);

  await expect(getLimitAlert(root)).toBeVisible();

  const [content] = await getContentGroupsForPage(root);
  const { scale } = await getPageSize(root);

  await selectContentOnCanvas(root, { x: (content.rect.x + 4) * scale, y: (content.rect.y + 4) * scale });

  // Duplicating would add a content, so it is gone; removing is still offered.
  await expect(getContentActionButton(root, 'Duplicate')).toHaveCount(0);
  await expect(getContentActionButton(root, 'Remove')).toBeVisible();

  await getContentActionButton(root, 'Remove').click();
  await expect.poll(() => getContentCountForPage(root)).toBe(0);

  // Back under the limit, the palette returns.
  await expect(getLimitAlert(root)).toHaveCount(0);
  await expect(getPaletteButton(root, 'Text')).toBeVisible();
});

test('image contents are limited separately from other contents', async ({ page }) => {
  const surface = await openEditorWithContentLimits(page, {
    envelopeContentCount: 0,
    envelopeContentImageCount: 1,
  });
  const root = surface.root;

  await openContentsTab(surface);

  await placeContentOnPdf(root, 'Text', { x: 120, y: 120 });
  await expect(getLimitAlert(root)).toHaveCount(0);

  await placeContentOnPdf(root, 'Image', { x: 120, y: 260 });
  await expect.poll(() => getContentCountForPage(root)).toBe(2);

  // The image allowance is used up even though contents are unlimited.
  await expect(getLimitAlert(root)).toBeVisible();
  await expect(getLimitAlert(root)).toContainText('cannot have more than 1 image content');
});
