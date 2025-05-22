import { expect, test } from '@playwright/test';

import { createDocumentAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[DOCUMENT_AUTH]: should grant access when not required', async ({ page }) => {
  const { user, team } = await seedUser();

  const { user: recipientWithAccount } = await seedUser();

  const document = await seedPendingDocument(user, team.id, [
    recipientWithAccount,
    'recipientwithoutaccount@documenso.com',
  ]);

  const recipients = await prisma.recipient.findMany({
    where: {
      documentId: document.id,
    },
  });

  const tokens = recipients.map((recipient) => recipient.token);

  for (const token of tokens) {
    await page.goto(`/sign/${token}`);
    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
  }
});

test('[DOCUMENT_AUTH]: should allow or deny access when required', async ({ page }) => {
  const { user, team } = await seedUser();

  const { user: recipientWithAccount } = await seedUser();

  const document = await seedPendingDocument(
    user,
    team.id,
    [recipientWithAccount, 'recipientwithoutaccount@documenso.com'],
    {
      createDocumentOptions: {
        authOptions: createDocumentAuthOptions({
          globalAccessAuth: 'ACCOUNT',
          globalActionAuth: null,
        }),
      },
    },
  );

  const recipients = await prisma.recipient.findMany({
    where: {
      documentId: document.id,
    },
  });

  // Check that both are denied access.
  for (const recipient of recipients) {
    const { email, token } = recipient;

    await page.goto(`/sign/${token}`);
    await expect(page.getByRole('heading', { name: 'Authentication required' })).toBeVisible();
    await expect(page.getByRole('paragraph')).toContainText(email);
  }

  await apiSignin({
    page,
    email: recipientWithAccount.email,
  });

  // Check that the one logged in is granted access.
  for (const recipient of recipients) {
    const { email, token } = recipient;

    await page.goto(`/sign/${token}`);

    // Recipient should be granted access.
    if (recipient.email === recipientWithAccount.email) {
      await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();
    }

    // Recipient should still be denied.
    if (recipient.email !== recipientWithAccount.email) {
      await expect(page.getByRole('heading', { name: 'Authentication required' })).toBeVisible();
      await expect(page.getByRole('paragraph')).toContainText(email);
    }
  }
});
