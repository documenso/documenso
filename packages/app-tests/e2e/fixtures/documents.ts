import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const checkDocumentTabCount = async (page: Page, tabName: string, count: number) => {
  const statusMap: Record<string, string | undefined> = {
    Inbox: 'INBOX',
    Pending: 'PENDING',
    Completed: 'COMPLETED',
    Draft: 'DRAFT',
    All: undefined,
  };

  const currentUrl = new URL(page.url());
  const status = statusMap[tabName];

  if (status) {
    currentUrl.searchParams.set('status', status);
  } else {
    currentUrl.searchParams.delete('status');
  }

  currentUrl.searchParams.delete('page');

  await page.goto(currentUrl.toString());

  if (count === 0) {
    await expect(page.getByTestId('empty-document-state')).toBeVisible();
    return;
  }

  await expect(page.getByTestId('data-table-count')).toContainText(`Showing ${count}`);
};
