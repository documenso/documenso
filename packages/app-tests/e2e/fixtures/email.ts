import { type APIRequestContext, expect } from '@playwright/test';

export type DeliveredConfirmationEmail = {
  id: string;
  url: URL;
};

// Inbucket ships with both the development and testing compose files. The env
// var is only a local override; CI relies on the default.
// biome-ignore lint/nursery/noUndeclaredEnvVars: Local override for the Playwright runner, not a Turbo task input.
const inbucketUrl = process.env.E2E_INBUCKET_URL ?? 'http://localhost:9000';

const getMailboxUrl = (email: string) => `${inbucketUrl}/api/v1/mailbox/${encodeURIComponent(email.split('@')[0])}`;

/**
 * Find the most recent email in the Inbucket mailbox that carries a
 * `/verify-email/<token>` link, skipping any message IDs already consumed.
 */
const findConfirmationEmail = async (
  request: APIRequestContext,
  email: string,
  excludedMessageIds: string[],
): Promise<DeliveredConfirmationEmail | undefined> => {
  const mailboxUrl = getMailboxUrl(email);

  const listResponse = await request.get(mailboxUrl);
  expect(listResponse.ok(), `Unable to read the Inbucket mailbox at ${inbucketUrl}`).toBe(true);

  const messages: { id: string }[] = await listResponse.json();

  for (const message of messages) {
    if (excludedMessageIds.includes(message.id)) {
      continue;
    }

    const messageResponse = await request.get(`${mailboxUrl}/${encodeURIComponent(message.id)}`);
    expect(messageResponse.ok()).toBe(true);

    const deliveredEmail: { body: { html: string } } = await messageResponse.json();
    const href = deliveredEmail.body.html.match(/href="([^"]+\/verify-email\/[^"]+)"/)?.[1];

    if (href) {
      return { id: message.id, url: new URL(href.replaceAll('&amp;', '&')) };
    }
  }

  return undefined;
};

/**
 * Wait for a confirmation email to be delivered to `email` and return its
 * verification link. Pass previously returned IDs in `excludedMessageIds` to
 * wait for a *new* email rather than matching an earlier one again.
 */
export const waitForConfirmationEmail = async (
  request: APIRequestContext,
  email: string,
  excludedMessageIds: string[] = [],
): Promise<DeliveredConfirmationEmail> => {
  await expect
    .poll(async () => (await findConfirmationEmail(request, email, excludedMessageIds)) !== undefined, {
      message: `Waiting for a delivered confirmation email for ${email}`,
      timeout: 30_000,
    })
    .toBe(true);

  const confirmation = await findConfirmationEmail(request, email, excludedMessageIds);

  if (!confirmation) {
    throw new Error(`Confirmation email for ${email} disappeared between polling and reading it`);
  }

  return confirmation;
};
