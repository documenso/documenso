import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { createDocumentsFixture } from './document';
import { createUsersFixture } from './user';

type Fixtures = {
  page: Page;
  samplePdf: { pdf: Buffer; pdfName: string };
  users: ReturnType<typeof createUsersFixture>;
  documents: ReturnType<typeof createDocumentsFixture>;
};

export const test = base.extend<Fixtures>({
  samplePdf: async ({ page: _page }, use) => {
    const examplePdf = fs.readFileSync(path.join(__dirname, '../../../assets/example.pdf'));
    await use({ pdf: examplePdf, pdfName: 'example.pdf' });
  },

  users: async ({ page }, use, workerInfo) => {
    const usersFixture = createUsersFixture(page, workerInfo);
    await use(usersFixture);
  },

  documents: async ({ page }, use) => {
    const documentsFixture = createDocumentsFixture(page);
    await use(documentsFixture);
  },
});
