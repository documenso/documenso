import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { SendStatus, SigningStatus } from '@documenso/prisma/client';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

test.describe('Redistribute updates recipient send status', () => {
  let user: User, team: Team, token: string;

  test.beforeEach(async () => {
    ({ user, team } = await seedUser());
    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    }));
  });

  test('marks a NOT_SENT signer as SENT after a successful resend', async ({ request }) => {
    const document = await seedPendingDocument(user, team.id, ['recipient@test.documenso.com']);

    const [recipient] = document.recipients;

    // Simulate a recipient that is stuck at NOT_SENT on a pending document
    // (e.g. the initial send did not dispatch an email for them).
    await prisma.recipient.update({
      where: { id: recipient.id },
      data: {
        sendStatus: SendStatus.NOT_SENT,
        signingStatus: SigningStatus.NOT_SIGNED,
        sentAt: null,
      },
    });

    const res = await request.post(`${baseUrl}/document/redistribute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        documentId: mapSecondaryIdToDocumentId(document.secondaryId),
        recipients: [recipient.id],
      },
    });

    expect(res.ok(), `redistribute should succeed: ${await res.text()}`).toBeTruthy();

    const updatedRecipient = await prisma.recipient.findFirstOrThrow({
      where: { id: recipient.id },
    });

    expect(updatedRecipient.sendStatus).toBe(SendStatus.SENT);
    expect(updatedRecipient.sentAt).not.toBeNull();
  });
});
