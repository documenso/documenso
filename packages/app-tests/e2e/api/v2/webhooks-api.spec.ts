import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import WebhookTriggerEventsSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/WebhookTriggerEventsSchema';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TCreateWebhookResponse } from '@documenso/trpc/server/webhook-router/create-webhook.types';
import type { TGetTeamWebhooksResponse } from '@documenso/trpc/server/webhook-router/get-team-webhooks.types';
import type { TGetWebhookByIdResponse } from '@documenso/trpc/server/webhook-router/get-webhook-by-id.types';
import { expect, test } from '@playwright/test';

const WebhookTriggerEvents = WebhookTriggerEventsSchema.enum;

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

const createTokenForUser = async (userId: number, teamId: number, tokenName: string) => {
  const { token } = await createApiToken({
    userId,
    teamId,
    tokenName,
    expiresIn: null,
  });

  return token;
};

test.describe('Webhooks API - CRUD', () => {
  test('should create, list, get, update, test, and delete a webhook', async ({ request }) => {
    const { user, team } = await seedUser();
    const token = await createTokenForUser(user.id, team.id, 'webhook-crud');

    const webhookUrl = `https://example.com/webhook-${Date.now()}`;

    const createRes = await request.post(`${baseUrl}/webhook/create`, {
      headers: { Authorization: token },
      data: {
        webhookUrl,
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_COMPLETED, WebhookTriggerEvents.DOCUMENT_SIGNED],
        secret: 'my-webhook-secret',
        enabled: true,
      },
    });

    expect(createRes.ok()).toBeTruthy();
    expect(createRes.status()).toBe(200);

    const createdWebhook = (await createRes.json()) as TCreateWebhookResponse;

    expect(createdWebhook.webhookUrl).toBe(webhookUrl);
    expect(createdWebhook.eventTriggers).toEqual([
      WebhookTriggerEvents.DOCUMENT_COMPLETED,
      WebhookTriggerEvents.DOCUMENT_SIGNED,
    ]);
    expect(createdWebhook.secret).toBe('my-webhook-secret');
    expect(createdWebhook.enabled).toBe(true);
    expect(createdWebhook.teamId).toBe(team.id);

    const listRes = await request.get(`${baseUrl}/webhook`, {
      headers: { Authorization: token },
    });

    expect(listRes.ok()).toBeTruthy();

    const webhooks = (await listRes.json()) as TGetTeamWebhooksResponse;

    expect(webhooks.some((webhook) => webhook.id === createdWebhook.id)).toBe(true);

    const getRes = await request.get(`${baseUrl}/webhook/${createdWebhook.id}`, {
      headers: { Authorization: token },
    });

    expect(getRes.ok()).toBeTruthy();

    const fetchedWebhook = (await getRes.json()) as TGetWebhookByIdResponse;

    expect(fetchedWebhook.id).toBe(createdWebhook.id);
    expect(fetchedWebhook.secret).toBe('my-webhook-secret');

    const updatedWebhookUrl = `https://example.com/webhook-updated-${Date.now()}`;

    const updateRes = await request.post(`${baseUrl}/webhook/update`, {
      headers: { Authorization: token },
      data: {
        id: createdWebhook.id,
        webhookUrl: updatedWebhookUrl,
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_SENT],
        secret: 'updated-secret',
        enabled: false,
      },
    });

    expect(updateRes.ok()).toBeTruthy();

    const updatedWebhook = (await updateRes.json()) as TCreateWebhookResponse;

    expect(updatedWebhook.webhookUrl).toBe(updatedWebhookUrl);
    expect(updatedWebhook.eventTriggers).toEqual([WebhookTriggerEvents.DOCUMENT_SENT]);
    expect(updatedWebhook.secret).toBe('updated-secret');
    expect(updatedWebhook.enabled).toBe(false);

    const testRes = await request.post(`${baseUrl}/webhook/test`, {
      headers: { Authorization: token },
      data: {
        id: createdWebhook.id,
        event: WebhookTriggerEvents.DOCUMENT_SENT,
      },
    });

    expect(testRes.ok()).toBeTruthy();

    const testResult = await testRes.json();

    expect(testResult.success).toBe(false);

    const deleteRes = await request.post(`${baseUrl}/webhook/delete`, {
      headers: { Authorization: token },
      data: {
        id: createdWebhook.id,
      },
    });

    expect(deleteRes.ok()).toBeTruthy();

    const deletedWebhook = await deleteRes.json();

    expect(deletedWebhook.id).toBe(createdWebhook.id);

    const deletedInDb = await prisma.webhook.findUnique({
      where: { id: createdWebhook.id },
    });

    expect(deletedInDb).toBeNull();
  });
});

test.describe('Webhooks API - Auth', () => {
  test('should reject requests without an API token', async ({ request }) => {
    const res = await request.get(`${baseUrl}/webhook`);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('should reject requests with an invalid API token', async ({ request }) => {
    const res = await request.get(`${baseUrl}/webhook`, {
      headers: { Authorization: 'api_invalidtoken123456' },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });
});

test.describe('Webhooks API - Isolation', () => {
  test('should not allow access to another team webhook', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();
    const tokenA = await createTokenForUser(userA.id, teamA.id, 'team-a');

    const { user: userB, team: teamB } = await seedUser();
    const tokenB = await createTokenForUser(userB.id, teamB.id, 'team-b');

    const webhook = await prisma.webhook.create({
      data: {
        webhookUrl: `https://example.com/webhook-${Date.now()}`,
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_CREATED],
        secret: 'team-a-secret',
        enabled: true,
        userId: userA.id,
        teamId: teamA.id,
      },
    });

    const getRes = await request.get(`${baseUrl}/webhook/${webhook.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(getRes.ok()).toBeFalsy();
    expect(getRes.status()).toBe(404);

    const listRes = await request.get(`${baseUrl}/webhook`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(listRes.ok()).toBeTruthy();

    const webhooks = (await listRes.json()) as TGetTeamWebhooksResponse;

    expect(webhooks.some((item) => item.id === webhook.id)).toBe(false);

    const deleteRes = await request.post(`${baseUrl}/webhook/delete`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { id: webhook.id },
    });

    expect(deleteRes.ok()).toBeFalsy();
    expect(deleteRes.status()).toBe(404);

    const listResA = await request.get(`${baseUrl}/webhook`, {
      headers: { Authorization: tokenA },
    });

    expect(listResA.ok()).toBeTruthy();

    const webhooksA = (await listResA.json()) as TGetTeamWebhooksResponse;

    expect(webhooksA.some((item) => item.id === webhook.id)).toBe(true);
  });
});

test.describe('Webhooks API - Validation', () => {
  test('should reject private webhook URLs', async ({ request }) => {
    const { user, team } = await seedUser();
    const token = await createTokenForUser(user.id, team.id, 'webhook-validation');

    const res = await request.post(`${baseUrl}/webhook/create`, {
      headers: { Authorization: token },
      data: {
        webhookUrl: 'http://127.0.0.1/webhook',
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_COMPLETED],
        secret: null,
        enabled: true,
      },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);
  });

  test('should reject webhook creation without event triggers', async ({ request }) => {
    const { user, team } = await seedUser();
    const token = await createTokenForUser(user.id, team.id, 'webhook-no-events');

    const res = await request.post(`${baseUrl}/webhook/create`, {
      headers: { Authorization: token },
      data: {
        webhookUrl: `https://example.com/webhook-${Date.now()}`,
        eventTriggers: [],
        secret: null,
        enabled: true,
      },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);
  });
});
