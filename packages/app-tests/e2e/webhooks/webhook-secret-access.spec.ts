import { prisma } from '@documenso/prisma';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { TeamMemberRole, WebhookTriggerEvents } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';

/**
 * Calls the procedure the way an attacker would — directly, from the authenticated browser
 * context, bypassing the UI entirely. The settings page is gated on MANAGE_TEAM, so going
 * through the UI would only prove the page is hidden, not that the data is protected.
 */
const callGetTeamWebhooks = async (page: Page, teamId: number) =>
  await page.evaluate(async (id) => {
    const response = await fetch('/api/trpc/webhook.getTeamWebhooks', {
      method: 'GET',
      headers: { 'content-type': 'application/json', 'x-team-id': String(id) },
    });

    return { status: response.status, body: await response.text() };
  }, teamId);

test.describe('Webhook secret access', () => {
  test('team managers can read webhook secrets', async ({ page }) => {
    const { owner, team } = await seedTeam();

    await prisma.webhook.create({
      data: {
        webhookUrl: 'https://example.com/hook',
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_SENT],
        secret: 'super-secret-signing-key',
        enabled: true,
        userId: owner.id,
        teamId: team.id,
      },
    });

    await apiSignin({ page, email: owner.email });
    await page.goto(`/t/${team.url}/settings/webhooks`);

    const { status, body } = await callGetTeamWebhooks(page, team.id);

    expect(status).toBe(200);
    // The edit dialog reads the secret straight off these rows, so managers must get it.
    expect(body).toContain('super-secret-signing-key');
  });

  test('team members without manage permission cannot read webhook secrets', async ({ page }) => {
    const { owner, team } = await seedTeam();

    await prisma.webhook.create({
      data: {
        webhookUrl: 'https://example.com/hook',
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_SENT],
        secret: 'super-secret-signing-key',
        enabled: true,
        userId: owner.id,
        teamId: team.id,
      },
    });

    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    await apiSignin({ page, email: member.email });
    await page.goto(`/t/${team.url}/documents`);

    const { status, body } = await callGetTeamWebhooks(page, team.id);

    // Whatever the failure mode, the signing key must never appear in the response.
    expect(body).not.toContain('super-secret-signing-key');
    expect(status).not.toBe(200);
  });
});
