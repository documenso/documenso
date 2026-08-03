import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Select a status in the documents status filter pill.
 *
 * No-op if the status is already selected, since selecting the active
 * option again would clear the filter.
 */
export const selectDocumentStatusFilter = async (page: Page, statusName: string) => {
  const currentStatus = new URL(page.url()).searchParams.get('status');

  if (currentStatus === statusName.toUpperCase()) {
    return;
  }

  await page.getByTestId('documents-table-status-filter').click();
  await page.getByRole('option', { name: statusName }).click();
};

/**
 * Clear the documents status filter pill, returning to the "All" view.
 */
export const clearDocumentStatusFilter = async (page: Page) => {
  const currentStatus = new URL(page.url()).searchParams.get('status');

  if (!currentStatus) {
    return;
  }

  await page.getByTestId('documents-table-status-filter').click();
  await page.getByRole('option', { name: 'Clear' }).click();
};

/**
 * Apply a status filter (or 'All' to clear it) and verify both the count
 * shown against the option in the filter popover and the resulting table.
 */
export const checkDocumentTabCount = async (page: Page, tabName: string, count: number) => {
  if (tabName === 'All') {
    await clearDocumentStatusFilter(page);
  } else {
    const currentStatus = new URL(page.url()).searchParams.get('status');

    await page.getByTestId('documents-table-status-filter').click();

    const option = page.getByRole('option', { name: tabName });

    await expect(option).toContainText(count.toString());

    if (currentStatus === tabName.toUpperCase()) {
      await page.keyboard.press('Escape');
    } else {
      await option.click();
    }
  }

  if (count === 0) {
    await expect(page.getByTestId('empty-document-state')).toBeVisible();
    return;
  }

  await expect(page.getByTestId('data-table-count')).toContainText(`Showing ${count}`);
};
