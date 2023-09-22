import { test as base } from '@playwright/test';

import { DocumentsPage } from './DocumentsPageObject';

export const test = base.extend<{ documentsPage: DocumentsPage }>({
  documentsPage: async ({ page }, use) => {
    const documentsPage = new DocumentsPage(page);

    await use(documentsPage);
  },
});

export { expect } from '@playwright/test';
