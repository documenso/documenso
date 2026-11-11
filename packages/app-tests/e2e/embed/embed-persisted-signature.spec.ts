import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

const PDF_PAGE_SELECTOR = 'img[data-page-number]';

const SIGNER_EMAIL = 'persisted-signer@test.documenso.com';
const CLIENT_USER_ID = 'usr_8f2c1b4e';

// Distinct from both the fixture default and the recipient name, which the
// type pad falls back to, so a prefilled value can only have come from storage.
const TYPED_SIGNATURE = 'Persisted Signer';

test.describe.configure({ mode: 'parallel' });

const openEmbed = async (page: Page, token: string) => {
  await page.goto(`/embed/sign/${token}?clientUserId=${CLIENT_USER_ID}`);

  await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });
};

for (const internalVersion of [1, 2] as const) {
  test(`[EMBED_PERSISTED_SIGNATURE]: persists the signature and prefills it on the next embed (v${internalVersion})`, async ({
    page,
  }) => {
    const { user: owner, team } = await seedUser();

    const seedDocument = async () => {
      const { recipients } = await seedPendingDocumentWithFullFields({
        owner,
        teamId: team.id,
        recipients: [SIGNER_EMAIL],
        fields: [FieldType.SIGNATURE],
        updateDocumentOptions: { internalVersion },
      });

      return recipients[0];
    };

    const firstRecipient = await seedDocument();

    await openEmbed(page, firstRecipient.token);

    await page.getByTestId('signature-pad-dialog-button').click();
    await page.getByRole('tab', { name: 'Type' }).click();
    await page.getByTestId('signature-pad-type-input').fill(TYPED_SIGNATURE);
    await page.getByRole('button', { name: 'Next' }).click();

    await expect
      .poll(() => prisma.embedSignature.findFirst({ where: { recipientId: firstRecipient.id } }), {
        timeout: 10_000,
      })
      .toMatchObject({ signature: TYPED_SIGNATURE });

    const secondRecipient = await seedDocument();

    await openEmbed(page, secondRecipient.token);

    await page.getByTestId('signature-pad-dialog-button').click();
    await page.getByRole('tab', { name: 'Type' }).click();

    await expect(page.getByTestId('signature-pad-type-input')).toHaveValue(TYPED_SIGNATURE);
  });
}
