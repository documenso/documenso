import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { hashString } from '@documenso/lib/server-only/auth/hash';
import { alphaid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const API_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({ mode: 'parallel' });

const seedApiTokenForUser = async ({ userId, teamId }: { userId: number; teamId: number }) => {
  const token = `api_${alphaid(16)}`;

  await prisma.apiToken.create({
    data: { name: 'attachment-url-test', token: hashString(token), expires: null, userId, teamId },
  });

  return { token };
};

/**
 * Attachment URLs are rendered as link hrefs, so they must be restricted to
 * http(s). The API must reject any other scheme.
 */
const NON_HTTP_URLS = [
  'javascript:alert(document.cookie)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
];

test('[ATTACHMENTS]: rejects attachment URLs with a non-http(s) protocol', async ({ request }) => {
  const { team, owner } = await seedTeam();
  const { token } = await seedApiTokenForUser({ userId: owner.id, teamId: team.id });

  const envelope = await seedBlankDocument(owner, team.id);

  for (const url of NON_HTTP_URLS) {
    const res = await request.post(`${API_BASE_URL}/envelope/attachment/create`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { envelopeId: envelope.id, data: { label: 'attachment', data: url } },
    });

    expect(res.ok(), `expected ${url} to be rejected`).toBe(false);
  }

  const attachments = await prisma.envelopeAttachment.findMany({ where: { envelopeId: envelope.id } });
  expect(attachments).toHaveLength(0);
});

test('[ATTACHMENTS]: accepts attachment URLs with an http(s) protocol', async ({ request }) => {
  const { team, owner } = await seedTeam();
  const { token } = await seedApiTokenForUser({ userId: owner.id, teamId: team.id });

  const envelope = await seedBlankDocument(owner, team.id);

  const res = await request.post(`${API_BASE_URL}/envelope/attachment/create`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { envelopeId: envelope.id, data: { label: 'safe', data: 'https://example.com/file.pdf' } },
  });

  expect(res.ok()).toBe(true);

  const attachments = await prisma.envelopeAttachment.findMany({ where: { envelopeId: envelope.id } });
  expect(attachments).toHaveLength(1);
  expect(attachments[0].data).toBe('https://example.com/file.pdf');
});
