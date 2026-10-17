import { prisma } from '@documenso/prisma';
import { expect, type Locator, type Page } from '@playwright/test';
import type { Field } from '@prisma/client';

export const SIGNING_PDF_PAGE_SELECTOR = 'img[data-page-number]';

type TSigningFieldPosition = Pick<Field, 'positionX' | 'positionY' | 'width' | 'height'>;

/**
 * Opens a V2 signing page and waits for the PDF and canvas to be ready.
 */
export const openSigningPage = async (page: Page, path: string) => {
  await page.goto(path);

  await expect(page.locator(SIGNING_PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

  const canvas = page.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  return canvas;
};

/**
 * Clicks the centre of a field on the signing canvas. Field positions are stored as
 * percentages of the page.
 */
export const clickSigningField = async (canvas: Locator, field: TSigningFieldPosition) => {
  await canvas.click({ position: await getSigningFieldCentre(canvas, field) });
};

/**
 * The group navigation bar shown for a grouped field. Bars crossfade when moving between
 * fields, so the bar is always resolved by the field it belongs to.
 */
export const getGroupBar = (page: Page, fieldId: number) => {
  return page.locator(`[data-testid="field-group-bar"][data-field-id="${fieldId}"]`);
};

/**
 * Moves the pointer onto the centre of a field on the signing canvas.
 */
export const hoverSigningField = async (canvas: Locator, field: TSigningFieldPosition) => {
  const canvasBox = await canvas.boundingBox();

  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  const { x, y } = await getSigningFieldCentre(canvas, field);

  await canvas.page().mouse.move(canvasBox.x + x, canvasBox.y + y);
};

const getSigningFieldCentre = async (canvas: Locator, field: TSigningFieldPosition) => {
  const canvasBox = await canvas.boundingBox();

  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  return {
    x: (Number(field.positionX) / 100) * canvasBox.width + ((Number(field.width) / 100) * canvasBox.width) / 2,
    y: (Number(field.positionY) / 100) * canvasBox.height + ((Number(field.height) / 100) * canvasBox.height) / 2,
  };
};

/**
 * Sets up a typed signature via the sidebar signature pad so signature fields can be
 * inserted with a single click.
 */
export const setupTypedSignature = async (page: Page, signature = 'Signature') => {
  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: 'Type' }).click();
  await page.getByTestId('signature-pad-type-input').fill(signature);
  await page.getByRole('button', { name: 'Next' }).click();
};

export const expectFieldsRemaining = async (page: Page, count: number) => {
  const text = count === 1 ? '1 Field Remaining' : `${count} Fields Remaining`;

  await expect(page.getByText(text).first()).toBeVisible({ timeout: 10_000 });
};

/**
 * Polls the database until the fields match the expected inserted state and value.
 */
export const expectFieldsInDatabase = async (
  expectations: Array<{ fieldId: number; inserted: boolean; customText?: string }>,
) => {
  await expect(async () => {
    const fields = await prisma.field.findMany({
      where: { id: { in: expectations.map((expectation) => expectation.fieldId) } },
    });

    for (const expectation of expectations) {
      const field = fields.find((field) => field.id === expectation.fieldId);

      expect(field, `Field ${expectation.fieldId} not found`).toBeDefined();
      expect(field?.inserted).toBe(expectation.inserted);

      if (expectation.customText !== undefined) {
        expect(field?.customText).toBe(expectation.customText);
      }
    }
  }).toPass({ timeout: 10_000 });
};

export const getCompleteButton = (page: Page) => page.getByRole('button', { name: 'Complete', exact: true }).first();

export const getNextFieldButton = (page: Page) => page.getByRole('button', { name: 'Next Field', exact: true }).first();

/**
 * Opens the completion dialog and confirms signing.
 *
 * Direct templates ask for the signer's details before completing, which can be provided
 * via `recipientDetails`.
 */
export const completeSigning = async (page: Page, recipientDetails?: { name: string; email: string }) => {
  await getCompleteButton(page).click();
  await expect(page.getByRole('heading', { name: 'Are you sure?' })).toBeVisible();

  if (recipientDetails) {
    await page.getByRole('textbox', { name: 'Your Name' }).fill(recipientDetails.name);
    await page.getByRole('textbox', { name: 'Your Email' }).fill(recipientDetails.email);
  }

  await page.getByRole('button', { name: 'Sign' }).click();
};
