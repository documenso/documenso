import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { EmailSuppressionScope, EmailSuppressionSource } from '@prisma/client';
import { z } from 'zod';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

const testEmail = (label: string) => `${label}-${nanoid(8)}@test.documenso.com`.toLowerCase();

/**
 * Redistributing sends the emails within the request, so the EMAIL_SENT audit logs are
 * complete once it responds. The async signing request jobs can't be asserted on reliably.
 */
test('[EMAIL_SUPPRESSION]: resending a document skips recipients who suppressed the sender', async ({ request }) => {
  const { user, team, organisation } = await seedUser();
  const { team: otherTeam } = await seedUser();

  const emails = {
    global: testEmail('global'),
    organisation: testEmail('organisation'),
    team: testEmail('team'),
    user: testEmail('user'),
    otherTeam: testEmail('other-team'),
    unsuppressed: testEmail('unsuppressed'),
  };

  // Upper case to check suppressions match regardless of how the recipient's email was entered.
  const document = await seedPendingDocument(user, team.id, [
    emails.global.toUpperCase(),
    emails.organisation,
    emails.team,
    emails.user,
    emails.otherTeam,
    emails.unsuppressed,
  ]);

  await prisma.emailSuppression.createMany({
    data: [
      { email: emails.global, scope: EmailSuppressionScope.GLOBAL },
      { email: emails.organisation, scope: EmailSuppressionScope.ORGANISATION, organisationId: organisation.id },
      { email: emails.team, scope: EmailSuppressionScope.TEAM, teamId: team.id },
      { email: emails.user, scope: EmailSuppressionScope.USER, userId: user.id },
      { email: emails.otherTeam, scope: EmailSuppressionScope.TEAM, teamId: otherTeam.id },
    ].map((suppression) => ({
      ...suppression,
      id: generateDatabaseId('email_suppression'),
      source: EmailSuppressionSource.ADMIN,
    })),
  });

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test',
    expiresIn: null,
  });

  const res = await request.post(`${WEBAPP_BASE_URL}/api/v2/envelope/redistribute`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      envelopeId: document.id,
      recipients: document.recipients.map((recipient) => recipient.id),
    },
  });

  expect(res.ok(), `redistribute should succeed: ${await res.text()}`).toBeTruthy();

  const auditLogs = await prisma.documentAuditLog.findMany({
    where: {
      envelopeId: document.id,
      type: 'EMAIL_SENT',
    },
  });

  const emailedAddresses = auditLogs.map((auditLog) => ZEmailSentDataSchema.parse(auditLog.data).recipientEmail);

  expect(emailedAddresses.sort()).toEqual([emails.otherTeam, emails.unsuppressed].sort());
});

const ZEmailSentDataSchema = z.object({
  recipientEmail: z.string(),
});
