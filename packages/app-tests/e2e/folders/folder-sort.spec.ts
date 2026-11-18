import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedTeam } from '@documenso/prisma/seed/teams';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../fixtures/authentication';

const readFolderCardNames = async (page: Page) => {
  return await page.locator('[data-folder-name]').evaluateAll((cards) => cards.map((card) => card.dataset.folderName));
};

/**
 * Seeds folders whose creation order differs from their alphabetical order, so
 * "Newest first" and "Name (A-Z)" produce different layouts.
 */
const seedFolders = async () => {
  const { owner, team } = await seedTeam();

  const seedFolder = async (name: string, minutesAgo: number, parentId?: string) => {
    return await seedBlankFolder(owner, team.id, {
      createFolderOptions: {
        name,
        parentId,
        createdAt: new Date(Date.now() - minutesAgo * 60_000),
      },
    });
  };

  const alpha = await seedFolder('Alpha', 30);
  await seedFolder('Charlie', 20);
  await seedFolder('Bravo', 10);

  await seedFolder('Yankee', 20, alpha.id);
  await seedFolder('Zulu', 10, alpha.id);

  return { owner, team, alpha };
};

test('[FOLDERS]: sort preference persists across reloads and folder navigation', async ({ page }) => {
  const { owner, team, alpha } = await seedFolders();

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect.poll(() => readFolderCardNames(page)).toEqual(['Bravo', 'Charlie', 'Alpha']);

  const savePreferences = page.waitForResponse(
    (response) => response.url().endsWith('/api/user-preferences') && response.ok(),
  );

  await page.getByTestId('folder-sort-dropdown').click();
  await page.getByRole('menuitemradio', { name: 'Name (A-Z)' }).click();

  await expect.poll(() => readFolderCardNames(page)).toEqual(['Alpha', 'Bravo', 'Charlie']);

  await savePreferences;

  // Server render: the root loader reads the preference from the cookie.
  await page.reload();

  await expect(page.getByTestId('folder-sort-dropdown')).toContainText('Name (A-Z)');
  await expect.poll(() => readFolderCardNames(page)).toEqual(['Alpha', 'Bravo', 'Charlie']);

  await page.locator('[data-folder-name="Alpha"]').getByText('Alpha').click();
  await page.waitForURL(`/t/${team.url}/documents/f/${alpha.id}`);

  await expect(page.getByTestId('folder-sort-dropdown')).toContainText('Name (A-Z)');
  await expect.poll(() => readFolderCardNames(page)).toEqual(['Yankee', 'Zulu']);
});

test('[FOLDERS]: invalid preferences cookie falls back to the default sort', async ({ page }) => {
  const { owner, team } = await seedFolders();

  // Encoded like React Router's `createCookie` (base64 JSON), so the value decodes
  // and reaches schema validation instead of failing earlier.
  const staleCookieValue = Buffer.from(JSON.stringify({ folderSort: 'bogus' })).toString('base64');

  await page
    .context()
    .addCookies([
      { name: 'user-preferences', value: encodeURIComponent(staleCookieValue), url: NEXT_PUBLIC_WEBAPP_URL() },
    ]);

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  await expect(page.getByTestId('folder-sort-dropdown')).toHaveText('Sort');
  await expect.poll(() => readFolderCardNames(page)).toEqual(['Bravo', 'Charlie', 'Alpha']);
});

test('[FOLDERS]: preference updates reject invalid values and cross-site requests', async ({ request }) => {
  const invalidValueResponse = await request.post('/api/user-preferences', {
    headers: WEBAPP_ORIGIN_HEADERS,
    data: { folderSort: 'bogus' },
  });

  expect(invalidValueResponse.status()).toBe(400);

  // React Router routes every one of these paths to the action.
  for (const path of ['/api/user-preferences', '/api/user-preferences/', '/API/user-preferences']) {
    const crossSiteResponse = await request.post(path, {
      headers: { Origin: 'https://attacker.example' },
      data: { folderSort: 'name-asc' },
    });

    expect(crossSiteResponse.status(), path).toBe(403);
  }
});
