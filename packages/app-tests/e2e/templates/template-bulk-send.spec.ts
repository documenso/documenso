import { prisma } from '@documenso/prisma';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedTemplate } from '@documenso/prisma/seed/templates';
import { expect, test } from '@playwright/test';
import { EnvelopeType } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { openDropdownMenu } from '../fixtures/generic';

test('[TEMPLATES]: bulk send via CSV from the table action dropdown', async ({ page }) => {
  const { team, owner } = await seedTeam();

  await seedTemplate({
    title: 'Bulk send template',
    userId: owner.id,
    teamId: team.id,
  });

  const uniqueRecipientEmail = `bulk-send-${Date.now()}@documenso.com`;

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  const actionBtn = page
    .getByRole('row', { name: 'Bulk send template' })
    .getByRole('cell', { name: 'Use Template' })
    .getByRole('button')
    .nth(1);

  await openDropdownMenu(page, actionBtn);

  await page.getByText('Bulk Send via CSV').click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Bulk Send Template via CSV' });

  await expect(dialog).toBeVisible();

  // Opening the native file picker blurs the window. Radix dropdown menus close themselves on
  // window blur, which used to unmount this dialog when it was nested inside the menu content,
  // silently discarding the user's file selection.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));

  await expect(dialog).toBeVisible();

  const csv = ['recipient_1_email,recipient_1_name', `${uniqueRecipientEmail},Bulk Recipient`].join('\n');

  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'bulk-send.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });

  await expect(dialog.getByText('bulk-send.csv')).toBeVisible();

  await dialog.getByRole('button', { name: 'Upload and Process' }).click();

  await expect(page.getByText('Your bulk send has been initiated').first()).toBeVisible();

  // The bulk send runs as a background job, so poll for the created document.
  await expect
    .poll(
      async () =>
        await prisma.envelope.count({
          where: {
            type: EnvelopeType.DOCUMENT,
            teamId: team.id,
            recipients: {
              some: {
                email: uniqueRecipientEmail,
              },
            },
          },
        }),
      { timeout: 30_000 },
    )
    .toBe(1);
});
