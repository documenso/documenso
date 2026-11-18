import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

type DocumentStatusCounts = {
  inbox?: number;
  pending?: number;
  completed?: number;
  draft?: number;
  cancelled?: number;
  rejected?: number;
  expired?: number;
  all?: number;
};

const STATUS_KEYS = {
  inbox: 'INBOX',
  pending: 'PENDING',
  completed: 'COMPLETED',
  draft: 'DRAFT',
  cancelled: 'CANCELLED',
  rejected: 'REJECTED',
  expired: 'EXPIRED',
  all: 'ALL',
} as const;

/**
 * Check the counts for multiple document statuses in one go via the
 * visually hidden stats rendered alongside the status filter.
 *
 * When `all` is provided the status filter is also cleared and the
 * unfiltered table count (or empty state) is verified.
 */
export const checkDocumentCounts = async (page: Page, counts: DocumentStatusCounts) => {
  for (const [key, status] of Object.entries(STATUS_KEYS)) {
    const count = counts[key as keyof typeof STATUS_KEYS];

    if (count === undefined) {
      continue;
    }

    await expect(page.getByTestId(`documents-status-count-${status}`)).toHaveText(count.toString());
  }

  if (counts.all !== undefined) {
    await clearDocumentStatusFilter(page);

    if (counts.all === 0) {
      await expect(page.getByTestId('empty-document-state')).toBeVisible();
      return;
    }

    await expect(page.getByTestId('data-table-count')).toContainText(`Showing ${counts.all}`);
  }
};

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
 * Toggle a sender in the documents sender filter pill.
 *
 * The sender filter is a multi select, so the popover stays open after
 * picking and is closed with Escape.
 */
export const toggleDocumentSenderFilter = async (page: Page, senderName: string) => {
  await page.getByTestId('documents-table-sender-filter').click();
  await page.getByRole('option', { name: senderName }).click();
  await page.waitForURL(/senderIds/);
  await page.keyboard.press('Escape');
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
 * Apply a status filter (or 'All' to clear it) and verify both the hidden
 * stats count and the resulting table.
 *
 * The count is not asserted against the stats for 'All', since tests use it
 * with search queries applied which only the table respects.
 */
export const checkDocumentTabCount = async (page: Page, tabName: string, count: number) => {
  if (tabName === 'All') {
    await clearDocumentStatusFilter(page);
  } else {
    await expect(page.getByTestId(`documents-status-count-${tabName.toUpperCase()}`)).toHaveText(count.toString());

    await selectDocumentStatusFilter(page, tabName);
  }

  if (count === 0) {
    await expect(page.getByTestId('empty-document-state')).toBeVisible();
    return;
  }

  await expect(page.getByTestId('data-table-count')).toContainText(`Showing ${count}`);
};
