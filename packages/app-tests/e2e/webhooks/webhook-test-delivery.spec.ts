import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { WebhookTriggerEvents } from '@prisma/client';

import { apiSignin, checkSessionValid, WEBAPP_ORIGIN_HEADERS } from '../fixtures/authentication';
import { expectTextToBeVisible } from '../fixtures/generic';

const seedDocumentCompletedWebhook = async ({
  userId,
  teamId,
  enabled = true,
}: {
  userId: number;
  teamId: number;
  enabled?: boolean;
}) =>
  await prisma.webhook.create({
    data: {
      webhookUrl: 'https://example.invalid/webhook',
      eventTriggers: [WebhookTriggerEvents.DOCUMENT_COMPLETED],
      enabled,
      userId,
      teamId,
    },
  });

// The local job provider inserts this row before `triggerJob` returns, so once the request
// has resolved the count is final.
const countDeliveryJobs = async (webhookId: string) =>
  await prisma.backgroundJob.count({
    where: {
      jobId: 'internal.execute-webhook',
      payload: {
        path: ['webhookId'],
        equals: webhookId,
      },
    },
  });

const requestTestWebhook = async (page: Page, { teamId, webhookId }: { teamId: number; webhookId: string }) =>
  await page.context().request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/trpc/webhook.testWebhook`, {
    headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json', 'x-team-id': String(teamId) },
    data: JSON.stringify({ json: { id: webhookId, event: WebhookTriggerEvents.DOCUMENT_COMPLETED } }),
  });

test('[WEBHOOKS]: test webhook only delivers to the selected webhook', async ({ page }) => {
  const { user, team } = await seedUser();

  const selectedWebhook = await seedDocumentCompletedWebhook({ userId: user.id, teamId: team.id });
  const otherWebhook = await seedDocumentCompletedWebhook({ userId: user.id, teamId: team.id });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/webhooks/${selectedWebhook.id}`,
  });

  await page.getByRole('button', { name: 'Test', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send' }).click();

  await expectTextToBeVisible(page, 'Test webhook queued');

  expect(await countDeliveryJobs(selectedWebhook.id)).toBe(1);
  expect(await countDeliveryJobs(otherWebhook.id)).toBe(0);
});

test('[WEBHOOKS]: disabled webhooks cannot be tested', async ({ page }) => {
  const { user, team } = await seedUser();

  const webhook = await seedDocumentCompletedWebhook({ userId: user.id, teamId: team.id, enabled: false });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/webhooks/${webhook.id}`,
  });

  await expect(page.getByRole('button', { name: 'Test', exact: true })).toBeDisabled();

  const response = await requestTestWebhook(page, { teamId: team.id, webhookId: webhook.id });

  expect(response.status()).toBe(400);
  expect(await response.text()).toContain('Webhook is disabled');
  expect(await countDeliveryJobs(webhook.id)).toBe(0);
});

test("[WEBHOOKS]: users cannot test another team's webhook", async ({ page }) => {
  const { user: owner, team: ownerTeam } = await seedUser();
  const { user: outsider, team: outsiderTeam } = await seedUser();

  const webhook = await seedDocumentCompletedWebhook({ userId: owner.id, teamId: ownerTeam.id });

  await apiSignin({ page, email: outsider.email });

  expect(await checkSessionValid(page)).toBe(true);

  for (const teamId of [ownerTeam.id, outsiderTeam.id]) {
    const response = await requestTestWebhook(page, { teamId, webhookId: webhook.id });

    expect(response.ok()).toBe(false);
  }

  expect(await countDeliveryJobs(webhook.id)).toBe(0);
});
