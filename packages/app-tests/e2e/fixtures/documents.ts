import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const checkDocumentTabCount = async (page: Page, tabName: string, count: number) => {
  await page.getByRole('tab', { name: tabName }).click();

  if (tabName !== 'All') {
    await expect(page.getByRole('tab', { name: tabName })).toContainText(count.toString());
  }

  if (count === 0) {
    await expect(page.getByTestId('empty-document-state')).toBeVisible();
    return;
  }

  await expect(page.getByTestId('data-table-count')).toContainText(`Showing ${count}`);
};
