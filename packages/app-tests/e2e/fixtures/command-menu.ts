import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Opens the app command menu via the keyboard shortcut.
 *
 * Retries the shortcut until the menu appears since the keypress is a no-op
 * when it happens before the page has hydrated.
 *
 * @param placeholder The search input placeholder to wait for, which differs
 *   between admin and non-admin users.
 */
export const openCommandMenu = async (page: Page, placeholder: string) => {
  await expect(async () => {
    await page.keyboard.press('Meta+K');
    await expect(page.getByPlaceholder(placeholder).first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
};
