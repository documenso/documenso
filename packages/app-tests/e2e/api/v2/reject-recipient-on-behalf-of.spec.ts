import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { DocumentVisibility, SigningStatus, TeamMemberRole } from '@documenso/prisma/client';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TRejectEnvelopeRecipientOnBehalfOfRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/reject-envelope-recipient-on-behalf-of.types';
import { type APIRequestContext, expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

const rejectRecipient = (
  request: APIRequestContext,
  authToken: string,
  envelopeId: string,
  recipientId: number,
  reason: string,
  actAsEmail?: string,
) => {
  return request.post(`${baseUrl}/envelope/recipient/${recipientId}/reject`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId,
      recipientId,
      reason,
      actAsEmail,
    } satisfies TRejectEnvelopeRecipientOnBehalfOfRequest,
  });
};

test.describe('Reject recipient on behalf of', () => {
  let user: User;
  let team: Team;
  let token: string;

  test.beforeEach(async () => {
    ({ user, team } = await seedUser());
    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-reject-recipient',
      expiresIn: null,
    }));
  });

  test('should reject a recipient and record an external rejection audit log', async ({ request }) => {
    const envelope = await seedPendingDocument(user, team.id, ['recipient@test.documenso.com']);
    const recipient = envelope.recipients[0];

    const res = await rejectRecipient(request, token, envelope.id, recipient.id, 'Declined out of band');

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const updatedRecipient = await prisma.recipient.findUniqueOrThrow({
      where: { id: recipient.id },
    });

    expect(updatedRecipient.signingStatus).toBe(SigningStatus.REJECTED);
    expect(updatedRecipient.rejectionReason).toBe('Declined out of band');

    const auditLog = await prisma.documentAuditLog.findFirst({
      where: {
        envelopeId: envelope.id,
        type: 'DOCUMENT_RECIPIENT_REJECTED',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditLog).not.toBeNull();

    const auditData = auditLog!.data as Record<string, unknown>;

    expect(auditData.recipientId).toBe(recipient.id);
    expect(auditData.recipientEmail).toBe(recipient.email);
    expect(auditData.reason).toBe('Declined out of band');
    expect(auditData.isExternal).toBe(true);

    // No actAsEmail supplied - the rejection defaults to the API user.
    expect(auditLog!.userId).toBe(user.id);
    expect(auditLog!.email).toBe(user.email);
    expect(auditData.onBehalfOfUserEmail).toBeUndefined();
  });

  test('should attribute the rejection to the elected team member when actAsEmail is supplied', async ({ request }) => {
    const member = await seedTeamMember({ teamId: team.id });

    const envelope = await seedPendingDocument(user, team.id, ['recipient@test.documenso.com']);
    const recipient = envelope.recipients[0];

    const res = await rejectRecipient(request, token, envelope.id, recipient.id, 'Declined out of band', member.email);

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const auditLog = await prisma.documentAuditLog.findFirstOrThrow({
      where: {
        envelopeId: envelope.id,
        type: 'DOCUMENT_RECIPIENT_REJECTED',
      },
      orderBy: { createdAt: 'desc' },
    });

    // The audit log actor must be the elected member, not the API user.
    expect(auditLog.userId).toBe(member.id);
    expect(auditLog.email).toBe(member.email);

    const auditData = auditLog.data as Record<string, unknown>;

    expect(auditData.isExternal).toBe(true);
    expect(auditData.onBehalfOfUserEmail).toBe(member.email);
  });

  test('should reject when actAsEmail is not a member of the team', async ({ request }) => {
    // A user that exists but belongs to a different team.
    const { user: outsider } = await seedUser();

    const envelope = await seedPendingDocument(user, team.id, ['recipient@test.documenso.com']);
    const recipient = envelope.recipients[0];

    const res = await rejectRecipient(
      request,
      token,
      envelope.id,
      recipient.id,
      'Declined out of band',
      outsider.email,
    );

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);

    // The recipient must remain untouched.
    const untouchedRecipient = await prisma.recipient.findUniqueOrThrow({
      where: { id: recipient.id },
    });

    expect(untouchedRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
    expect(untouchedRecipient.rejectionReason).toBeNull();
  });

  test('should deny rejecting a recipient that has already actioned the document', async ({ request }) => {
    const envelope = await seedPendingDocument(user, team.id, ['recipient@test.documenso.com']);
    const recipient = envelope.recipients[0];

    // Reject once - succeeds.
    const firstRes = await rejectRecipient(request, token, envelope.id, recipient.id, 'First rejection');
    expect(firstRes.ok()).toBeTruthy();

    // Reject again - the recipient is no longer NOT_SIGNED.
    const secondRes = await rejectRecipient(request, token, envelope.id, recipient.id, 'Second rejection');

    expect(secondRes.ok()).toBeFalsy();
    expect(secondRes.status()).toBe(400);

    // The original rejection reason must remain unchanged.
    const updatedRecipient = await prisma.recipient.findUniqueOrThrow({
      where: { id: recipient.id },
    });

    expect(updatedRecipient.rejectionReason).toBe('First rejection');
  });

  test('should not allow rejecting a recipient in another team', async ({ request }) => {
    // Seed a separate team/user that owns the document.
    const { user: otherUser, team: otherTeam } = await seedUser();

    const envelope = await seedPendingDocument(otherUser, otherTeam.id, ['recipient@test.documenso.com']);
    const recipient = envelope.recipients[0];

    // Use the original team's token - it must not be able to reject.
    const res = await rejectRecipient(request, token, envelope.id, recipient.id, 'Should not work');

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);

    // The recipient must remain untouched.
    const untouchedRecipient = await prisma.recipient.findUniqueOrThrow({
      where: { id: recipient.id },
    });

    expect(untouchedRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
    expect(untouchedRecipient.rejectionReason).toBeNull();
  });

  test('should return 404 for a non-existent recipient', async ({ request }) => {
    const envelope = await seedPendingDocument(user, team.id, ['recipient@test.documenso.com']);

    const res = await rejectRecipient(request, token, envelope.id, 999999999, 'No such recipient');

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should return 404 when the recipient does not belong to the supplied envelope', async ({ request }) => {
    const targetEnvelope = await seedPendingDocument(user, team.id, ['recipient@test.documenso.com']);
    const otherEnvelope = await seedPendingDocument(user, team.id, ['other-recipient@test.documenso.com']);

    const recipient = targetEnvelope.recipients[0];

    // Valid recipient ID, but paired with the wrong envelope ID.
    const res = await rejectRecipient(request, token, otherEnvelope.id, recipient.id, 'Mismatched envelope');

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);

    // The recipient must remain untouched.
    const untouchedRecipient = await prisma.recipient.findUniqueOrThrow({
      where: { id: recipient.id },
    });

    expect(untouchedRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
    expect(untouchedRecipient.rejectionReason).toBeNull();
  });

  test('should enforce document visibility: manager cannot reject on an ADMIN-only document', async ({ request }) => {
    // The API token belongs to a MANAGER, who cannot see ADMIN-visibility docs.
    const { team: visTeam, owner } = await seedTeam();
    const manager = await seedTeamMember({ teamId: visTeam.id, role: TeamMemberRole.MANAGER });

    const { token: managerToken } = await createApiToken({
      userId: manager.id,
      teamId: visTeam.id,
      tokenName: 'manager-reject-token',
      expiresIn: null,
    });

    // ADMIN-visibility document owned by the team owner.
    const envelope = await seedPendingDocument(owner, visTeam.id, ['recipient@test.documenso.com'], {
      createDocumentOptions: { visibility: DocumentVisibility.ADMIN },
    });
    const recipient = envelope.recipients[0];

    const res = await rejectRecipient(
      request,
      managerToken,
      envelope.id,
      recipient.id,
      'Should be hidden by visibility',
    );

    // Visibility failure surfaces as not-found, matching the canonical checks.
    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);

    const untouchedRecipient = await prisma.recipient.findUniqueOrThrow({
      where: { id: recipient.id },
    });

    expect(untouchedRecipient.signingStatus).toBe(SigningStatus.NOT_SIGNED);
    expect(untouchedRecipient.rejectionReason).toBeNull();
  });
});
