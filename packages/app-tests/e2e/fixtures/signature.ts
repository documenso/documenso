import type { Page } from '@playwright/test';

export const signSignaturePad = async (page: Page) => {
  await page.waitForTimeout(200);

  const canvas = page.getByTestId('signature-pad');

  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Signature pad not found');
  }

  // Calculate center point
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  // Calculate square size (making it slightly smaller than the canvas)
  const squareSize = Math.min(box.width, box.height) * 0.4; // 40% of the smallest dimension

  // Move to center
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();

  // Draw square clockwise from center
  // Move right
  await page.mouse.move(centerX + squareSize, centerY, { steps: 10 });
  // Move down
  await page.mouse.move(centerX + squareSize, centerY + squareSize, { steps: 10 });
  // Move left
  await page.mouse.move(centerX - squareSize, centerY + squareSize, { steps: 10 });
  // Move up
  await page.mouse.move(centerX - squareSize, centerY - squareSize, { steps: 10 });
  // Move right
  await page.mouse.move(centerX + squareSize, centerY - squareSize, { steps: 10 });
  // Move down to close the square
  await page.mouse.move(centerX + squareSize, centerY, { steps: 10 });

  await page.mouse.up();
};
