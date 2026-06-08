import { seedDocuments } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentStatus } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';

test('[DOCUMENTS]: personal inbox can filter by status and search', async ({ page }) => {
  const { user: recipient } = await seedUser();
  const { user: pendingSender, team: pendingSenderTeam } = await seedUser();
  const { user: completedSender, team: completedSenderTeam } = await seedUser();

  await seedDocuments([
    {
      sender: pendingSender,
      recipients: [recipient],
      type: DocumentStatus.PENDING,
      teamId: pendingSenderTeam.id,
      documentOptions: {
        title: 'Inbox Pending Filter Doc',
      },
    },
    {
      sender: completedSender,
      recipients: [recipient],
      type: DocumentStatus.COMPLETED,
      teamId: completedSenderTeam.id,
      documentOptions: {
        title: 'Inbox Completed Filter Doc',
      },
    },
  ]);

  await apiSignin({
    page,
    email: recipient.email,
    redirectPath: '/inbox',
  });

  await expect(page.getByRole('tab', { name: 'All' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Completed' })).toBeVisible();
  await expect(page.getByPlaceholder('Search documents...')).toBeVisible();

  await expect(page.getByText('Inbox Pending Filter Doc')).toBeVisible();
  await expect(page.getByText('Inbox Completed Filter Doc')).toBeVisible();

  await page.getByRole('tab', { name: 'Pending' }).click();
  await page.waitForURL(
    (url) => url.pathname === '/inbox' && url.searchParams.get('status') === DocumentStatus.PENDING,
  );

  await expect(page.getByText('Inbox Pending Filter Doc')).toBeVisible();
  await expect(page.getByText('Inbox Completed Filter Doc')).not.toBeVisible();

  await page.getByRole('tab', { name: 'All' }).click();
  await page.waitForURL((url) => url.pathname === '/inbox' && !url.searchParams.has('status'));

  await page.getByPlaceholder('Search documents...').fill('Completed Filter');
  await page.waitForURL((url) => url.pathname === '/inbox' && url.searchParams.get('query') === 'Completed Filter');

  await expect(page.getByText('Inbox Completed Filter Doc')).toBeVisible();
  await expect(page.getByText('Inbox Pending Filter Doc')).not.toBeVisible();
});
