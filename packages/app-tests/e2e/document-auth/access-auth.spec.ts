import { generateTwoFactorTokenFromEmail } from '@documenso/lib/server-only/2fa/email/generate-2fa-token-from-email';
import { createDocumentAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument, seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { FieldType, type User } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

test('[DOCUMENT_AUTH]: should grant access when not required', async ({ page }) => {
  const { user, team } = await seedUser();

  const { user: recipientWithAccount } = await seedUser();

  const document = await seedPendingDocument(user, team.id, [
    recipientWithAccount,
    'recipientwithoutaccount@documenso.com',
  ]);

  const recipients = await prisma.recipient.findMany({
    where: {
      envelopeId: document.id,
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
          globalAccessAuth: ['ACCOUNT'],
          globalActionAuth: [],
        }),
      },
    },
  );

  const recipients = await prisma.recipient.findMany({
    where: {
      envelopeId: document.id,
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

test('[DOCUMENT_AUTH]: should open the email code step when 2FA access auth has no authenticator', async ({ page }) => {
  const recipient = await seedTwoFactorAccessDocument(seedTestEmail());

  await page.goto(`/sign/${recipient.token}`);
  await openTwoFactorStep(page, recipient.fields[0].id);

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('heading', { name: 'Enter verification code' })).toBeVisible();

  // The timer only shows after the email request succeeds.
  await expect(dialog.getByText(/Expires in/)).toBeVisible();

  const code = await generateTwoFactorTokenFromEmail({
    envelopeId: recipient.envelopeId,
    email: recipient.email,
  });

  await dialog.getByLabel('2FA code').fill(code);
  await dialog.getByRole('button', { name: 'Verify & Complete' }).click();

  await page.waitForURL(`/sign/${recipient.token}/complete`);
});

test('[DOCUMENT_AUTH]: should let a recipient with an authenticator choose the 2FA method', async ({ page }) => {
  const { user: recipientUser } = await seedUser();

  const recipient = await seedTwoFactorAccessDocument(recipientUser);

  await apiSignin({ page, email: recipientUser.email });

  await prisma.user.update({
    where: { id: recipientUser.id },
    data: { twoFactorEnabled: true },
  });

  await page.goto(`/sign/${recipient.token}`);
  await openTwoFactorStep(page, recipient.fields[0].id);

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('heading', { name: 'Choose verification method' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Authenticator app/ })).toBeVisible();
});

const seedTwoFactorAccessDocument = async (recipient: User | string) => {
  const { user, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [recipient],
    fields: [FieldType.SIGNATURE],
    updateDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: ['TWO_FACTOR_AUTH'],
        globalActionAuth: [],
      }),
    },
  });

  return recipients[0];
};

const openTwoFactorStep = async (page: Page, signatureFieldId: number) => {
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  await page.locator(`#field-${signatureFieldId}`).getByRole('button').click();
  await expect(page.locator(`#field-${signatureFieldId}`)).toHaveAttribute('data-inserted', 'true');

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
};
