import type { Locator } from '@playwright/test';
import { type Page, expect } from '@playwright/test';

export const expectTextToBeVisible = async (page: Page, text: string) => {
  await expect(page.getByText(text).first()).toBeVisible();
};

export const expectTextToNotBeVisible = async (page: Page, text: string) => {
  await expect(page.getByText(text).first()).not.toBeVisible();
};

export const expectToastTextToBeVisible = async (page: Page, text: string) => {
  await expect(page.locator('[role="status"]').getByText(text)).toBeVisible();
};

export const openDropdownMenu = async (page: Page, dropdownButton: Locator) => {
  await page.waitForTimeout(500); // Initial timeout incase table remounts which will close the dropdown.
  await dropdownButton.focus();
  await page.keyboard.press('Enter');

  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await dropdownButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('menuitem').first()).toBeVisible();
};
