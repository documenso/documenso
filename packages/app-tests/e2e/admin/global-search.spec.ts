import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { customAlphabet } from 'nanoid';

import { apiSignin } from '../fixtures/authentication';
import { openCommandMenu } from '../fixtures/command-menu';

test.describe.configure({ mode: 'parallel' });

const nanoid = customAlphabet('1234567890abcdef', 10);

const ADMIN_PROMPT_PLACEHOLDER = 'Search documents, users, organisations…';

test('[ADMIN][GLOBAL_SEARCH]: numeric query shows verified user result and navigates', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: targetUser } = await seedUser();

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first().fill(String(targetUser.id));

  await expect(page.getByText('Global Users', { exact: true })).toBeVisible();

  // The category chips include the admin groups with their result counts.
  await expect(page.getByRole('button', { name: /Global Users/ })).toBeVisible();

  const userOption = page.getByRole('option').filter({ hasText: targetUser.email }).first();

  // Admin results are real links so they support native link behaviour such
  // as opening in a new tab.
  await expect(userOption.getByRole('link')).toHaveAttribute('href', `/admin/users/${targetUser.id}`);

  await userOption.click();

  await page.waitForURL(`/admin/users/${targetUser.id}`);
});

test('[ADMIN][GLOBAL_SEARCH]: numeric query shows verified team result and navigates', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { team: targetTeam } = await seedUser();

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first().fill(String(targetTeam.id));

  await expect(page.getByText('Global Teams', { exact: true })).toBeVisible();

  await page.getByRole('option').filter({ hasText: targetTeam.url }).first().click();

  await page.waitForURL(`/admin/teams/${targetTeam.id}`);
});

test('[ADMIN][GLOBAL_SEARCH]: text query shows document result and navigates', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, team } = await seedUser();

  const document = await seedPendingDocument(sender, team.id, [], {
    createDocumentOptions: { title: `admin-ui-search-${nanoid()}` },
  });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first().fill(document.title);

  await expect(page.getByText('Global Documents', { exact: true })).toBeVisible();

  await page.getByRole('option').filter({ hasText: document.secondaryId }).first().click();

  await page.waitForURL(`/admin/documents/${document.id}`);
});

test('[ADMIN][GLOBAL_SEARCH]: envelope_ prefixed query resolves exact document', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: sender, team } = await seedUser();

  const document = await seedPendingDocument(sender, team.id, [], {
    createDocumentOptions: { title: `admin-ui-search-${nanoid()}` },
  });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first().fill(document.id);

  await expect(page.getByText('Global Documents', { exact: true })).toBeVisible();
  await expect(page.getByRole('option').filter({ hasText: document.title }).first()).toBeVisible();
});

test('[ADMIN][GLOBAL_SEARCH]: admin search requires more than 3 characters unless numeric', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const adminSearchRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('admin.search')) {
      adminSearchRequests.push(request.url());
    }
  });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  const input = page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first();

  // A 3 character non-numeric query must not trigger the admin search. The
  // personal document search fires for any non-empty query, so its response
  // is the synchronization anchor proving the debounced queries have fired.
  const documentSearchResponse = page.waitForResponse((response) => response.url().includes('document.search'));

  await input.fill('abc');

  await documentSearchResponse;

  await expect(page.getByText(/^Global /)).toHaveCount(0);
  expect(adminSearchRequests).toHaveLength(0);

  // A numeric query fires regardless of length.
  const adminSearchRequest = page.waitForRequest((request) => request.url().includes('admin.search'));

  await input.fill('7');

  await adminSearchRequest;
});

test('[ADMIN][GLOBAL_SEARCH]: search bar position stays fixed while searching', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: targetUser } = await seedUser();

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  const input = page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first();

  const initialY = (await input.boundingBox())?.y;

  expect(initialY).toBeGreaterThan(0);

  // The height of the prompt may change as results come and go, but the
  // search bar must never move.
  await input.fill(String(targetUser.id));

  await expect(page.getByText('Global Users', { exact: true })).toBeVisible();

  const resultsY = (await input.boundingBox())?.y;

  expect(resultsY).toBe(initialY);

  // The search bar must not move when there are no results at all.
  await input.fill('zzzz-no-such-thing-9x7q');

  await expect(page.getByText('No results for')).toBeVisible();

  const emptyY = (await input.boundingBox())?.y;

  expect(emptyY).toBe(initialY);
});

test('[ADMIN][GLOBAL_SEARCH]: default view shows the document page links outside a team context', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  // Admin pages have no current team, the page links must still show.
  await page.goto('/admin/stats');

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await expect(page.getByRole('option').filter({ hasText: 'All documents' })).toBeVisible();
  await expect(page.getByRole('option').filter({ hasText: 'Draft documents' })).toBeVisible();
  await expect(page.getByRole('option').filter({ hasText: 'All templates' })).toBeVisible();

  // Chips only show for categories with actual results, not for the
  // hardcoded page links.
  await expect(page.getByRole('button', { name: /^Documents/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Templates/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Settings/ })).toBeVisible();
});

test('[ADMIN][GLOBAL_SEARCH]: theme can be changed from the prompt', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await page.getByRole('option').filter({ hasText: 'Change theme' }).first().click();

  // The sub page has a contextual placeholder and a back option.
  await expect(page.getByPlaceholder('Search themes…')).toBeVisible();
  await expect(page.getByRole('option').filter({ hasText: 'Back' }).first()).toBeVisible();

  await expect(page.getByRole('option').filter({ hasText: 'Dark Mode' })).toBeVisible();

  await page.getByRole('option').filter({ hasText: 'Dark Mode' }).first().click();

  await expect(page.locator('html')).toHaveClass(/dark/);

  // The back option returns to the root view.
  await page.getByRole('option').filter({ hasText: 'Back' }).first().click();

  await expect(page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first()).toBeVisible();
});

test('[ADMIN][GLOBAL_SEARCH]: capped admin groups offer a view all link', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const namePrefix = `viewall-${nanoid()}`;

  // Seed enough users sharing a name prefix to hit the 5 result cap.
  for (let i = 0; i < 5; i++) {
    await seedUser({ name: `${namePrefix}-${i}` });
  }

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first().fill(namePrefix);

  await expect(page.getByText('Global Users', { exact: true })).toBeVisible();

  const viewAllOption = page.getByRole('option').filter({ hasText: 'View all results' }).first();

  await expect(viewAllOption.getByRole('link')).toHaveAttribute(
    'href',
    `/admin/users?search=${encodeURIComponent(namePrefix)}`,
  );
});

test('[ADMIN][GLOBAL_SEARCH]: first result is highlighted after every search', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: firstUser } = await seedUser();
  const { user: secondUser } = await seedUser();

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  const input = page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first();

  // First search selects the first result.
  await input.fill(String(firstUser.id));

  await expect(page.getByRole('option').filter({ hasText: firstUser.email }).first()).toBeVisible();
  await expect(page.locator('[cmdk-item]').first()).toHaveAttribute('aria-selected', 'true');

  // A subsequent search with entirely new results must select the first
  // result again.
  await input.fill(String(secondUser.id));

  await expect(page.getByRole('option').filter({ hasText: secondUser.email }).first()).toBeVisible();
  await expect(page.locator('[cmdk-item]').first()).toHaveAttribute('aria-selected', 'true');
});

test('[ADMIN][GLOBAL_SEARCH]: static items match fuzzy queries', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  // "setg" is a non-contiguous abbreviation of "Settings".
  await page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first().fill('setg');

  // Wait for the debounced filter to apply first, "Draft documents" can
  // never match "setg" under either matching strategy.
  await expect(page.getByRole('option').filter({ hasText: 'Draft documents' })).toHaveCount(0);

  await expect(page.getByRole('option').filter({ hasText: 'Settings' }).first()).toBeVisible();
});

test('[ADMIN][GLOBAL_SEARCH]: page scrollbar is hidden while the prompt is open', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await expect
    .poll(async () => await page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .toBe('hidden');

  await page.keyboard.press('Escape');

  await expect
    .poll(async () => await page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .toBe('visible');
});

test('[ADMIN][GLOBAL_SEARCH]: non-admin gets the prompt without the admin search', async ({ page }) => {
  const { user, team } = await seedUser({ isAdmin: false });

  const document = await seedPendingDocument(user, team.id, []);

  const adminSearchRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('admin.search')) {
      adminSearchRequests.push(request.url());
    }
  });

  await apiSignin({ page, email: user.email });

  // Non-admins get the same prompt with a non-admin placeholder.
  await openCommandMenu(page, 'Type a command or search...');

  await expect(page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER)).toHaveCount(0);

  await page.getByPlaceholder('Type a command or search...').first().fill(document.title);

  // Wait for the regular (non-admin) search to resolve so we know the
  // debounced queries have fired.
  await expect(page.getByRole('option', { name: document.title })).toBeVisible();

  await expect(page.getByText(/^Global /)).toHaveCount(0);
  expect(adminSearchRequests).toHaveLength(0);
});

test('[ADMIN][GLOBAL_SEARCH]: typing on a sub page fires no search requests', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const searchRequests: string[] = [];

  page.on('request', (request) => {
    if (/api\/trpc\/(document|template|admin)\.search/.test(request.url())) {
      searchRequests.push(request.url());
    }
  });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await page.getByRole('option').filter({ hasText: 'Change theme' }).first().click();

  const input = page.getByPlaceholder('Search themes…');

  await expect(input).toBeVisible();

  // Long enough to pass the admin search threshold if it were enabled.
  await input.fill('dark');

  // The client-side filter applying proves the typing registered.
  await expect(page.getByRole('option').filter({ hasText: 'Dark Mode' })).toBeVisible();
  await expect(page.getByRole('option').filter({ hasText: 'Light Mode' })).toHaveCount(0);

  // Wait out the 200ms search debounce with a wide margin before asserting
  // that no requests fired: there is no response to anchor on when the
  // desired behaviour is "no requests at all".
  await page.waitForTimeout(750);

  expect(searchRequests).toHaveLength(0);
});

test('[ADMIN][GLOBAL_SEARCH]: failed searches show an error state instead of no results', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await page.route(/api\/trpc\/(document|template|admin)\.search/, async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first().fill('zzzz-no-such-thing-9x7q');

  // A failed search must be honest about it, not claim there are no results.
  await expect(page.getByText('Something went wrong')).toBeVisible();
  await expect(page.getByText('No results for')).toHaveCount(0);
});

test('[ADMIN][GLOBAL_SEARCH]: partial search failure still shows results with a notice', async ({ page }) => {
  const { user: adminUser, team } = await seedUser({ isAdmin: true });

  const document = await seedPendingDocument(adminUser, team.id, [], {
    createDocumentOptions: { title: `partial-fail-${nanoid()}` },
  });

  // Only the admin search fails: the personal searches succeed.
  await page.route(/api\/trpc\/admin\.search/, async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  await page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first().fill(document.title);

  // The successful personal document search must still render its results.
  await expect(page.getByRole('option', { name: document.title })).toBeVisible();

  // The failed admin search must be flagged rather than silently dropped.
  await expect(page.getByText('Some searches failed')).toBeVisible();
});

test('[ADMIN][GLOBAL_SEARCH]: over-length query skips the admin search without erroring', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const adminSearchRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('admin.search')) {
      adminSearchRequests.push(request.url());
    }
  });

  await apiSignin({ page, email: adminUser.email });

  await openCommandMenu(page, ADMIN_PROMPT_PLACEHOLDER);

  // The admin search endpoint rejects queries longer than 100 characters, so
  // the client must not send them. The personal searches accept up to 1024
  // characters and still run, anchoring the debounced query flush.
  const documentSearchResponse = page.waitForResponse((response) => response.url().includes('document.search'));

  await page.getByPlaceholder(ADMIN_PROMPT_PLACEHOLDER).first().fill('a'.repeat(150));

  await documentSearchResponse;

  // The personal searches ran and found nothing: the honest empty state, with
  // no error in sight.
  await expect(page.getByText('No results for')).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);

  expect(adminSearchRequests).toHaveLength(0);
});
