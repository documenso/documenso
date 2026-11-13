import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, DocumentStatus, FieldType } from '@prisma/client';

import { signSignaturePad } from '../fixtures/signature';

type SeededRecipient = Awaited<ReturnType<typeof seedPendingDocumentWithFullFields>>['recipients'][number];

const completeSigning = async (page: Page, recipient: SeededRecipient) => {
  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  for (const field of recipient.fields) {
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
};

const expectWaiting = async (page: Page, token: string) => {
  await page.goto(`/sign/${token}`);
  await page.waitForURL(`/sign/${token}/waiting`);
};

test('[SIGNING_GROUPS]: group members sign in any order and gate the next step', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: signer1 } = await seedUser();
  const { user: signer2a } = await seedUser();
  const { user: signer2b } = await seedUser();
  const { user: signer3 } = await seedUser();

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [signer1, signer2a, signer2b, signer3],
    recipientsCreateOptions: [{ signingOrder: 1 }, { signingOrder: 2 }, { signingOrder: 2 }, { signingOrder: 3 }],
    updateDocumentOptions: {
      documentMeta: {
        upsert: {
          create: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
          update: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
        },
      },
    },
  });

  const [recipient1, recipient2a, recipient2b, recipient3] = recipients;

  // While step 1 is pending, both group members and step 3 are blocked.
  await expectWaiting(page, recipient2a.token);
  await expectWaiting(page, recipient2b.token);
  await expectWaiting(page, recipient3.token);

  await completeSigning(page, recipient1);

  // The group is now active; step 3 is still blocked.
  await expectWaiting(page, recipient3.token);

  // Sign with the SECOND group member first to prove any-order signing.
  await completeSigning(page, recipient2b);

  // One group member remains — step 3 stays blocked.
  await expectWaiting(page, recipient3.token);

  await completeSigning(page, recipient2a);

  // The whole group is done — step 3 unlocks and completes the document.
  await completeSigning(page, recipient3);

  await expect
    .poll(async () => {
      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: document.id },
      });

      return envelope.status;
    })
    .toBe(DocumentStatus.COMPLETED);
});
