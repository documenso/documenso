import { type Page, expect } from '@playwright/test';

export const expectTextToBeVisible = async (page: Page, text: string) => {
  await expect(page.getByText(text).first()).toBeVisible();
};

export const expectTextToNotBeVisible = async (page: Page, text: string) => {
  await expect(page.getByText(text).first()).not.toBeVisible();
};
