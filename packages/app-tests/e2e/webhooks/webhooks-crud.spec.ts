import { expect, test } from '@playwright/test';
import { WebhookCallStatus, WebhookTriggerEvents } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import { expectTextToBeVisible } from '../fixtures/generic';

/**
 * Helper function to seed a webhook directly in the database for testing.
 */
const seedWebhook = async ({
  webhookUrl,
  eventTriggers,
  secret,
  enabled,
  userId,
  teamId,
}: {
  webhookUrl: string;
  eventTriggers: WebhookTriggerEvents[];
  secret?: string | null;
  enabled?: boolean;
  userId: number;
  teamId: number;
}) => {
  return await prisma.webhook.create({
    data: {
      webhookUrl,
      eventTriggers,
      secret: secret ?? null,
      enabled: enabled ?? true,
      userId,
      teamId,
    },
  });
};

test('[WEBHOOKS]: create webhook', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/webhooks`,
  });

  const webhookUrl = `https://example.com/webhook-${Date.now()}`;

  // Click Create Webhook button
  await page.getByRole('button', { name: 'Create Webhook' }).click();

  // Fill in the form
  await page.getByLabel('Webhook URL*').fill(webhookUrl);

  // Select event trigger - click on the triggers field and select DOCUMENT_CREATED
  await page.getByLabel('Triggers').click();
  await page.waitForTimeout(200); // Wait for dropdown to open
  await page.getByText('document.created').click();

  // Click outside the triggers field to close the dropdown
  await page.getByText('The URL for Documenso to send webhook events to.').click();

  // Fill in the form
  await page.getByLabel('Secret').fill('secret');

  // Submit the form
  await page.getByRole('button', { name: 'Create' }).click();

  // Wait for success toast
  await expectTextToBeVisible(page, 'Webhook created');
  await expectTextToBeVisible(page, 'The webhook was successfully created.');

  // Verify webhook appears in the list
  await expect(page.getByText(webhookUrl)).toBeVisible();

  // Directly check database
  const dbWebhook = await prisma.webhook.findFirstOrThrow({
    where: {
      userId: user.id,
    },
  });

  expect(dbWebhook?.eventTriggers).toEqual([WebhookTriggerEvents.DOCUMENT_CREATED]);
  expect(dbWebhook?.secret).toBe('secret');
  expect(dbWebhook?.enabled).toBe(true);
});

test('[WEBHOOKS]: view webhooks', async ({ page }) => {
  const { user, team } = await seedUser();

  const webhookUrl = `https://example.com/webhook-${Date.now()}`;

  // Create a webhook via seeding
  const webhook = await seedWebhook({
    webhookUrl,
    eventTriggers: [WebhookTriggerEvents.DOCUMENT_CREATED, WebhookTriggerEvents.DOCUMENT_SENT],
    userId: user.id,
    teamId: team.id,
    enabled: true,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/webhooks`,
  });

  // Verify webhook is visible in the table
  await expect(page.getByText(webhookUrl)).toBeVisible();
  await expect(page.getByText('Enabled')).toBeVisible();
  await expect(page.getByText('2 Events')).toBeVisible();

  // Click on webhook to navigate to detail page
  await page.getByText(webhookUrl).click();

  // Verify detail page shows webhook information
  await page.waitForURL(`/t/${team.url}/settings/webhooks/${webhook.id}`);
  await expect(page.getByText(webhookUrl)).toBeVisible();
  await expect(page.getByText('Enabled')).toBeVisible();
});

test('[WEBHOOKS]: delete webhook', async ({ page }) => {
  const { user, team } = await seedUser();

  const webhookUrl = `https://example.com/webhook-${Date.now()}`;

  // Create a webhook via seeding
  const webhook = await seedWebhook({
    webhookUrl,
    eventTriggers: [WebhookTriggerEvents.DOCUMENT_CREATED],
    userId: user.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/webhooks`,
  });

  // Verify webhook is visible
  await expect(page.getByText(webhookUrl)).toBeVisible();

  // Find the row with the webhook and click the action dropdown
  const webhookRow = page.locator('tr', { hasText: webhookUrl });
  await webhookRow.getByTestId('webhook-table-action-btn').click();

  // Click Delete menu item
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  // Fill in confirmation field
  const deleteMessage = `delete ${webhookUrl}`;
  // The label contains "Confirm by typing:" followed by the delete message
  await page.getByLabel(/Confirm by typing/).fill(deleteMessage);

  // Click delete button
  await page.getByRole('button', { name: 'Delete' }).click();

  // Wait for success toast
  await expectTextToBeVisible(page, 'Webhook deleted');
  await expectTextToBeVisible(page, 'The webhook has been successfully deleted.');

  // Verify webhook is removed from the list
  await expect(page.getByText(webhookUrl)).not.toBeVisible();
});

test('[WEBHOOKS]: update webhook', async ({ page }) => {
  const { user, team } = await seedUser();

  const originalWebhookUrl = `https://example.com/webhook-original-${Date.now()}`;
  const updatedWebhookUrl = `https://example.com/webhook-updated-${Date.now()}`;

  // Create a webhook via seeding with initial values
  const webhook = await seedWebhook({
    webhookUrl: originalWebhookUrl,
    eventTriggers: [WebhookTriggerEvents.DOCUMENT_CREATED, WebhookTriggerEvents.DOCUMENT_SENT],
    userId: user.id,
    teamId: team.id,
    enabled: true,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/webhooks`,
  });

  // Verify webhook is visible with original values
  await expect(page.getByText(originalWebhookUrl)).toBeVisible();
  await expect(page.getByText('Enabled')).toBeVisible();
  await expect(page.getByText('2 Events')).toBeVisible();

  // Find the row with the webhook and click the action dropdown
  const webhookRow = page.locator('tr', { hasText: originalWebhookUrl });
  await webhookRow.getByTestId('webhook-table-action-btn').click();

  // Click Edit menu item
  await page.getByRole('menuitem', { name: 'Edit' }).click();

  // Wait for dialog to open
  await page.waitForTimeout(200);

  // Change the webhook URL
  await page.getByLabel('Webhook URL').clear();
  await page.getByLabel('Webhook URL').fill(updatedWebhookUrl);

  // Disable the webhook (toggle the switch)
  const enabledSwitch = page.getByLabel('Enabled');
  const isChecked = await enabledSwitch.isChecked();
  if (isChecked) {
    await enabledSwitch.click();
  }

  // Change the event triggers - remove one existing event and add a new one
  // The selected items are shown as badges with remove buttons
  // Remove one of the existing events (DOCUMENT_SENT) by clicking its remove button
  const removeButtons = page.locator('button[aria-label="Remove"]');
  const removeButtonCount = await removeButtons.count();

  // Remove the "DOCUMENT_SENT" event (this will remove one of the two)
  if (removeButtonCount > 0) {
    await removeButtons.nth(1).click();
    await page.waitForTimeout(200);
  }

  // Add new event triggers
  await page.getByLabel('Triggers').click();
  await page.waitForTimeout(200);

  // Select DOCUMENT_COMPLETED (this will be added to the remaining DOCUMENT_CREATED)
  await page.getByText('document.completed').click();
  await page.waitForTimeout(200);

  // Click outside to close the dropdown
  await page.getByText('The URL for Documenso to send webhook events to.').click();

  // Submit the form
  await page.getByRole('button', { name: 'Update' }).click();

  // Wait for success toast
  await expectTextToBeVisible(page, 'Webhook updated');
  await expectTextToBeVisible(page, 'The webhook has been updated successfully.');

  // Verify changes are reflected in the list
  // The old URL should be gone and new URL should be visible
  await expect(page.getByText(originalWebhookUrl)).not.toBeVisible();
  await expect(page.getByText(updatedWebhookUrl)).toBeVisible();
  // Verify webhook is disabled
  await expect(page.getByText('Disabled')).toBeVisible();
  // Verify event count is still 2 (one removed, one added - DOCUMENT_CREATED and DOCUMENT_COMPLETED)
  await expect(page.getByText('2 Events')).toBeVisible();

  // Check the database directly to verify
  const dbWebhook = await prisma.webhook.findUnique({
    where: {
      id: webhook.id,
    },
  });

  expect(dbWebhook?.eventTriggers).toEqual([
    WebhookTriggerEvents.DOCUMENT_CREATED,
    WebhookTriggerEvents.DOCUMENT_COMPLETED,
  ]);
  expect(dbWebhook?.enabled).toBe(false);
  expect(dbWebhook?.webhookUrl).toBe(updatedWebhookUrl);
  expect(dbWebhook?.secret).toBe('');
});

test('[WEBHOOKS]: cannot see unrelated webhooks', async ({ page }) => {
  // Create two separate users with teams
  const user1Data = await seedUser();
  const user2Data = await seedUser();

  const webhookUrl1 = `https://example.com/webhook-team1-${Date.now()}`;
  const webhookUrl2 = `https://example.com/webhook-team2-${Date.now()}`;

  // Create webhooks for both teams with DOCUMENT_CREATED event
  const webhook1 = await seedWebhook({
    webhookUrl: webhookUrl1,
    eventTriggers: [WebhookTriggerEvents.DOCUMENT_CREATED],
    userId: user1Data.user.id,
    teamId: user1Data.team.id,
    enabled: true,
  });

  const webhook2 = await seedWebhook({
    webhookUrl: webhookUrl2,
    eventTriggers: [WebhookTriggerEvents.DOCUMENT_SENT],
    userId: user2Data.user.id,
    teamId: user2Data.team.id,
  });

  // Create a document on team1 to trigger the webhook
  const document = await seedBlankDocument(user1Data.user, user1Data.team.id, {
    createDocumentOptions: {
      title: 'Test Document for Webhook',
    },
  });

  // Create a webhook call for team1's webhook (simulating the webhook being triggered)
  // Since webhooks are triggered via jobs which may not run in tests, we create the call directly
  const webhookCall1 = await prisma.webhookCall.create({
    data: {
      webhookId: webhook1.id,
      url: webhookUrl1,
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      status: WebhookCallStatus.SUCCESS,
      responseCode: 200,
      requestBody: {
        event: WebhookTriggerEvents.DOCUMENT_CREATED,
        payload: {
          id: document.id,
          title: document.title,
        },
        createdAt: new Date().toISOString(),
        webhookEndpoint: webhookUrl1,
      },
    },
  });

  // Sign in as user1
  await apiSignin({
    page,
    email: user1Data.user.email,
    redirectPath: `/t/${user1Data.team.url}/settings/webhooks`,
  });

  // Verify user1 can see their webhook
  await expect(page.getByText(webhookUrl1)).toBeVisible();
  // Verify user1 cannot see user2's webhook
  await expect(page.getByText(webhookUrl2)).not.toBeVisible();

  // Navigate to team1's webhook logs page
  await page.goto(
    `${NEXT_PUBLIC_WEBAPP_URL()}/t/${user1Data.team.url}/settings/webhooks/${webhook1.id}`,
  );

  // Verify user1 can see their webhook logs
  // The webhook call should be visible in the table
  await expect(page.getByText(webhookCall1.id)).toBeVisible();
  await expect(page.getByText('200')).toBeVisible(); // Response code

  // Sign out and sign in as user2
  await apiSignout({ page });
  await apiSignin({
    page,
    email: user2Data.user.email,
    redirectPath: `/t/${user2Data.team.url}/settings/webhooks`,
  });

  // Verify user2 can see their webhook
  await expect(page.getByText(webhookUrl2)).toBeVisible();
  // Verify user2 cannot see user1's webhook
  await expect(page.getByText(webhookUrl1)).not.toBeVisible();

  // Navigate to team2's webhook logs page
  await page.goto(
    `${NEXT_PUBLIC_WEBAPP_URL()}/t/${user2Data.team.url}/settings/webhooks/${webhook2.id}`,
  );

  // Verify user2 cannot see team1's webhook logs
  // The webhook call from team1 should not be visible
  await expect(page.getByText(webhookCall1.id)).not.toBeVisible();

  // Attempt to access user1's webhook detail page directly via URL
  await page.goto(
    `${NEXT_PUBLIC_WEBAPP_URL()}/t/${user2Data.team.url}/settings/webhooks/${webhook1.id}`,
  );

  // Verify access is denied - should show error or redirect
  // Based on the component, it shows a 404 error page
  await expect(page.getByRole('heading', { name: 'Webhook not found' })).toBeVisible();
});
