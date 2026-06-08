import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

declare global {
  interface Window {
    recordSignatureDraw?: (event: { text: string; caveatLoaded: boolean; fontStatus: string }) => Promise<void>;
  }
}

test.use({ storageState: { cookies: [], origins: [] } });

test('[USER] profile typed signature preview waits for the signature font on direct page load', async ({ page }) => {
  const typedSignature = 'Issue 2945 Signature';
  const drawEvents: Array<{ text: string; caveatFontFulfilled: boolean; caveatLoaded: boolean; fontStatus: string }> =
    [];
  let caveatFontFulfilled = false;

  const { user } = await seedUser({
    name: 'Issue 2945 User',
  });

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      signature: typedSignature,
    },
  });

  await page.exposeBinding('recordSignatureDraw', (_source, event) => {
    drawEvents.push({
      ...(event as { text: string; caveatLoaded: boolean; fontStatus: string }),
      caveatFontFulfilled,
    });
  });

  await page.addInitScript((signatureText) => {
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;

    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (String(text) === signatureText) {
        void window.recordSignatureDraw?.({
          text: String(text),
          caveatLoaded: document.fonts.check('18px Caveat'),
          fontStatus: document.fonts.status,
        });
      }

      return originalFillText.call(this, text, ...args);
    };
  }, typedSignature);

  await page.route('**/fonts/caveat-variablefont_wght.ttf', async (route) => {
    const response = await route.fetch();

    await new Promise((resolve) => setTimeout(resolve, 1500));

    caveatFontFulfilled = true;

    await route.fulfill({ response });
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/settings/profile',
  });

  await expect(page).toHaveURL('/settings/profile');
  await expect(page.getByTestId('signature-pad-dialog-button')).toBeVisible();

  await expect.poll(() => drawEvents.length).toBeGreaterThan(0);

  expect(drawEvents).not.toContainEqual(
    expect.objectContaining({
      text: typedSignature,
      caveatFontFulfilled: false,
    }),
  );
});
