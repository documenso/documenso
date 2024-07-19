import { expect, test } from '@playwright/test';

import { ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import {
  createDocumentAuthOptions,
  createRecipientAuthOptions,
} from '@documenso/lib/utils/document-auth';
import { FieldType } from '@documenso/prisma/client';
import {
  seedPendingDocumentNoFields,
  seedPendingDocumentWithFullFields,
} from '@documenso/prisma/seed/documents';
import { seedTestEmail, seedUser, unseedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

test('[DOCUMENT_AUTH]: should allow signing when no auth setup', async ({ page }) => {
  const user = await seedUser();

  const recipientWithAccount = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: [recipientWithAccount, seedTestEmail()],
  });

  // Check that both are granted access.
  for (const recipient of recipients) {
    const { token, Field } = recipient;

    const signUrl = `/sign/${token}`;

    await page.goto(signUrl);
    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

    // Add signature.
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
      await page.mouse.up();
    }

    for (const field of Field) {
      await page.locator(`#field-${field.id}`).getByRole('button').click();

      if (field.type === FieldType.TEXT) {
        await page.locator('#custom-text').fill('TEXT');
        await page.getByRole('button', { name: 'Save' }).click();
      }

      await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
    }

    await page.getByRole('button', { name: 'Complete' }).click();
    await page.getByRole('button', { name: 'Sign' }).click();
    await page.waitForURL(`${signUrl}/complete`);
  }

  await unseedUser(user.id);
  await unseedUser(recipientWithAccount.id);
});

test('[DOCUMENT_AUTH]: should allow signing with valid global auth', async ({ page }) => {
  const user = await seedUser();

  const recipientWithAccount = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: [recipientWithAccount],
    updateDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: null,
        globalActionAuth: 'ACCOUNT',
      }),
    },
  });

  const recipient = recipients[0];

  const { token, Field } = recipient;

  const signUrl = `/sign/${token}`;

  await apiSignin({
    page,
    email: recipientWithAccount.email,
    redirectPath: signUrl,
  });

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  // Add signature.
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    await page.mouse.up();
  }

  for (const field of Field) {
    await page.locator(`#field-${field.id}`).getByRole('button').click();

    if (field.type === FieldType.TEXT) {
      await page.locator('#custom-text').fill('TEXT');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
  }

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);

  await unseedUser(user.id);
  await unseedUser(recipientWithAccount.id);
});

// Currently document auth for signing/approving/viewing is not required.
test.skip('[DOCUMENT_AUTH]: should deny signing document when required for global auth', async ({
  page,
}) => {
  const user = await seedUser();

  const recipientWithAccount = await seedUser();

  const { recipients } = await seedPendingDocumentNoFields({
    owner: user,
    recipients: [recipientWithAccount],
    updateDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: null,
        globalActionAuth: 'ACCOUNT',
      }),
    },
  });

  const recipient = recipients[0];

  const { token } = recipient;

  await page.goto(`/sign/${token}`);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('paragraph')).toContainText(
    'Reauthentication is required to sign the document',
  );

  await unseedUser(user.id);
  await unseedUser(recipientWithAccount.id);
});

test('[DOCUMENT_AUTH]: should deny signing fields when required for global auth', async ({
  page,
}) => {
  const user = await seedUser();

  const recipientWithAccount = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: [recipientWithAccount, seedTestEmail()],
    updateDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: null,
        globalActionAuth: 'ACCOUNT',
      }),
    },
  });

  // Check that both are denied access.
  for (const recipient of recipients) {
    const { token, Field } = recipient;

    await page.goto(`/sign/${token}`);
    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

    for (const field of Field) {
      if (field.type !== FieldType.SIGNATURE) {
        continue;
      }

      await page.locator(`#field-${field.id}`).getByRole('button').click();
      await expect(page.getByRole('paragraph')).toContainText(
        'Reauthentication is required to sign this field',
      );
      await page.getByRole('button', { name: 'Cancel' }).click();
    }
  }

  await unseedUser(user.id);
  await unseedUser(recipientWithAccount.id);
});

test('[DOCUMENT_AUTH]: should allow field signing when required for recipient auth', async ({
  page,
}) => {
  const user = await seedUser();

  const recipientWithInheritAuth = await seedUser();
  const recipientWithExplicitNoneAuth = await seedUser();
  const recipientWithExplicitAccountAuth = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: [
      recipientWithInheritAuth,
      recipientWithExplicitNoneAuth,
      recipientWithExplicitAccountAuth,
    ],
    recipientsCreateOptions: [
      {
        authOptions: createRecipientAuthOptions({
          accessAuth: null,
          actionAuth: null,
        }),
      },
      {
        authOptions: createRecipientAuthOptions({
          accessAuth: null,
          actionAuth: 'EXPLICIT_NONE',
        }),
      },
      {
        authOptions: createRecipientAuthOptions({
          accessAuth: null,
          actionAuth: 'ACCOUNT',
        }),
      },
    ],
    fields: [FieldType.DATE],
  });

  for (const recipient of recipients) {
    const { token, Field } = recipient;
    const { actionAuth } = ZRecipientAuthOptionsSchema.parse(recipient.authOptions);

    // This document has no global action auth, so only account should require auth.
    const isAuthRequired = actionAuth === 'ACCOUNT';

    const signUrl = `/sign/${token}`;

    await page.goto(signUrl);
    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

    if (isAuthRequired) {
      for (const field of Field) {
        if (field.type !== FieldType.SIGNATURE) {
          continue;
        }

        await page.locator(`#field-${field.id}`).getByRole('button').click();
        await expect(page.getByRole('paragraph')).toContainText(
          'Reauthentication is required to sign this field',
        );
        await page.getByRole('button', { name: 'Cancel' }).click();
      }

      // Sign in and it should work.
      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });
    }

    // Add signature.
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
      await page.mouse.up();
    }

    for (const field of Field) {
      await page.locator(`#field-${field.id}`).getByRole('button').click();

      if (field.type === FieldType.TEXT) {
        await page.locator('#custom-text').fill('TEXT');
        await page.getByRole('button', { name: 'Save' }).click();
      }

      await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true', {
        timeout: 5000,
      });
    }

    await page.getByRole('button', { name: 'Complete' }).click();
    await page.getByRole('button', { name: 'Sign' }).click();
    await page.waitForURL(`${signUrl}/complete`);

    if (isAuthRequired) {
      await apiSignout({ page });
    }
  }
});

test('[DOCUMENT_AUTH]: should allow field signing when required for recipient and global auth', async ({
  page,
}) => {
  const user = await seedUser();

  const recipientWithInheritAuth = await seedUser();
  const recipientWithExplicitNoneAuth = await seedUser();
  const recipientWithExplicitAccountAuth = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: [
      recipientWithInheritAuth,
      recipientWithExplicitNoneAuth,
      recipientWithExplicitAccountAuth,
    ],
    recipientsCreateOptions: [
      {
        authOptions: createRecipientAuthOptions({
          accessAuth: null,
          actionAuth: null,
        }),
      },
      {
        authOptions: createRecipientAuthOptions({
          accessAuth: null,
          actionAuth: 'EXPLICIT_NONE',
        }),
      },
      {
        authOptions: createRecipientAuthOptions({
          accessAuth: null,
          actionAuth: 'ACCOUNT',
        }),
      },
    ],
    fields: [FieldType.DATE],
    updateDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: null,
        globalActionAuth: 'ACCOUNT',
      }),
    },
  });

  for (const recipient of recipients) {
    const { token, Field } = recipient;
    const { actionAuth } = ZRecipientAuthOptionsSchema.parse(recipient.authOptions);

    // This document HAS global action auth, so account and inherit should require auth.
    const isAuthRequired = actionAuth === 'ACCOUNT' || actionAuth === null;

    const signUrl = `/sign/${token}`;

    await page.goto(signUrl);
    await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

    if (isAuthRequired) {
      for (const field of Field) {
        if (field.type !== FieldType.SIGNATURE) {
          continue;
        }

        await page.locator(`#field-${field.id}`).getByRole('button').click();
        await expect(page.getByRole('paragraph')).toContainText(
          'Reauthentication is required to sign this field',
        );
        await page.getByRole('button', { name: 'Cancel' }).click();
      }

      // Sign in and it should work.
      await apiSignin({
        page,
        email: recipient.email,
        redirectPath: signUrl,
      });
    }

    // Add signature.
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
      await page.mouse.up();
    }

    for (const field of Field) {
      await page.locator(`#field-${field.id}`).getByRole('button').click();

      if (field.type === FieldType.TEXT) {
        await page.locator('#custom-text').fill('TEXT');
        await page.getByRole('button', { name: 'Save' }).click();
      }

      await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true', {
        timeout: 5000,
      });
    }

    await page.getByRole('button', { name: 'Complete' }).click();
    await page.getByRole('button', { name: 'Sign' }).click();
    await page.waitForURL(`${signUrl}/complete`);

    if (isAuthRequired) {
      await apiSignout({ page });
    }
  }
});
