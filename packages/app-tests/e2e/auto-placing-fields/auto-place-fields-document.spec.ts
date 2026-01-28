import { type Page, expect, test } from '@playwright/test';
import path from 'path';

import { prisma } from '@documenso/prisma';
import { RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

const FIXTURES_DIR = path.join(__dirname, '../../../assets/fixtures/auto-placement');

const SINGLE_PLACEHOLDER_PDF_PATH = path.join(
  FIXTURES_DIR,
  'project-proposal-single-recipient.pdf',
);

const MULTIPLE_PLACEHOLDER_PDF_PATH = path.join(
  FIXTURES_DIR,
  'project-proposal-multiple-fields-and-recipients.pdf',
);

const NO_RECIPIENT_PDF_PATH = path.join(FIXTURES_DIR, 'no-recipient-placeholders.pdf');

const INVALID_FIELD_TYPE_PDF_PATH = path.join(FIXTURES_DIR, 'invalid-field-type.pdf');

const FIELD_TYPE_ONLY_PDF_PATH = path.join(FIXTURES_DIR, 'field-type-only.pdf');

const setTeamDefaultRecipients = async (
  teamId: number,
  defaultRecipients: Array<{ email: string; name: string; role: RecipientRole }>,
) => {
  const teamSettings = await prisma.teamGlobalSettings.findFirstOrThrow({
    where: {
      team: {
        id: teamId,
      },
    },
  });

  await prisma.teamGlobalSettings.update({
    where: {
      id: teamSettings.id,
    },
    data: {
      defaultRecipients,
    },
  });
};

const setupUserAndSignIn = async (page: Page) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  return { user, team };
};

const uploadPdf = async (page: Page, team: { url: string }, pdfPath: string) => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .locator('input[type=file]')
      .nth(1)
      .evaluate((e) => {
        if (e instanceof HTMLInputElement) {
          e.click();
        }
      }),
  ]);

  await fileChooser.setFiles(pdfPath);

  // Wait for redirect to v2 envelope editor.
  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  // Extract envelope ID from URL.
  const urlParts = page.url().split('/');
  const envelopeId = urlParts.find((part) => part.startsWith('envelope_'));

  if (!envelopeId) {
    throw new Error('Could not extract envelope ID from URL');
  }

  return envelopeId;
};

test.describe('PDF Placeholders with single recipient', () => {
  test('[AUTO_PLACING_FIELDS]: should create placeholder recipients even with default recipients', async ({
    page,
  }) => {
    const { user, team } = await seedUser();

    await setTeamDefaultRecipients(team.id, [
      {
        email: user.email,
        name: user.name || user.email,
        role: RecipientRole.CC,
      },
    ]);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    const envelopeId = await uploadPdf(page, team, SINGLE_PLACEHOLDER_PDF_PATH);

    await expect(async () => {
      const recipients = await prisma.recipient.findMany({
        where: { envelopeId },
      });

      const placeholderRecipient = recipients.find(
        (recipient) => recipient.email === 'recipient.1@documenso.com',
      );

      const defaultRecipient = recipients.find((recipient) => recipient.email === user.email);

      expect(placeholderRecipient).toBeDefined();
      expect(defaultRecipient).toBeDefined();

      const fields = await prisma.field.findMany({
        where: { envelopeId },
      });

      expect(fields.length).toBeGreaterThan(0);
      expect(fields.every((field) => field.recipientId === placeholderRecipient!.id)).toBe(true);
    }).toPass();
  });

  test('[AUTO_PLACING_FIELDS]: should automatically create recipients from PDF placeholders', async ({
    page,
  }) => {
    const { team } = await setupUserAndSignIn(page);
    await uploadPdf(page, team, SINGLE_PLACEHOLDER_PDF_PATH);

    // V2 editor shows recipients on the upload page under "Recipients" heading.
    await expect(page.getByRole('heading', { name: 'Recipients' })).toBeVisible();
    await expect(page.getByTestId('signer-email-input').first()).toHaveValue(
      'recipient.1@documenso.com',
    );
    await expect(page.getByLabel('Name').first()).toHaveValue('Recipient 1');
  });

  test('[AUTO_PLACING_FIELDS]: should automatically place fields from PDF placeholders', async ({
    page,
  }) => {
    const { team } = await setupUserAndSignIn(page);
    const envelopeId = await uploadPdf(page, team, SINGLE_PLACEHOLDER_PDF_PATH);

    // V2 editor renders fields on a Konva canvas, so we verify via the database.
    await expect(async () => {
      const fields = await prisma.field.findMany({
        where: { envelopeId },
      });

      const fieldTypes = fields.map((f) => f.type).sort();
      expect(fieldTypes).toEqual(['EMAIL', 'NAME', 'SIGNATURE', 'TEXT'].sort());
    }).toPass();
  });

  test('[AUTO_PLACING_FIELDS]: should automatically configure fields from PDF placeholders', async ({
    page,
  }) => {
    const { team } = await setupUserAndSignIn(page);
    const envelopeId = await uploadPdf(page, team, SINGLE_PLACEHOLDER_PDF_PATH);

    // Verify field metadata was correctly parsed from the placeholder.
    await expect(async () => {
      const textField = await prisma.field.findFirst({
        where: { envelopeId, type: 'TEXT' },
      });

      expect(textField).toBeDefined();
      expect(textField!.fieldMeta).toBeDefined();

      const meta = textField!.fieldMeta as Record<string, unknown>;
      expect(meta.required).toBe(true);
      expect(meta.textAlign).toBe('right');
    }).toPass();
  });
});

test.describe('PDF Placeholders with multiple recipients', () => {
  test('[AUTO_PLACING_FIELDS]: should automatically create recipients from PDF placeholders', async ({
    page,
  }) => {
    const { team } = await setupUserAndSignIn(page);
    const envelopeId = await uploadPdf(page, team, MULTIPLE_PLACEHOLDER_PDF_PATH);

    // V2 editor shows recipients on the upload page.
    await expect(page.getByRole('heading', { name: 'Recipients' })).toBeVisible();

    await expect(page.getByTestId('signer-email-input').first()).toHaveValue(
      'recipient.1@documenso.com',
    );

    await expect(page.getByTestId('signer-email-input').nth(1)).toHaveValue(
      'recipient.2@documenso.com',
    );

    await expect(page.getByTestId('signer-email-input').nth(2)).toHaveValue(
      'recipient.3@documenso.com',
    );

    // Verify recipients via the database for name validation since the v2 editor
    // only shows the "Name" label on the first recipient row.
    await expect(async () => {
      const recipients = await prisma.recipient.findMany({
        where: { envelopeId },
        orderBy: { signingOrder: 'asc' },
      });

      expect(recipients).toHaveLength(3);
      expect(recipients[0].name).toBe('Recipient 1');
      expect(recipients[1].name).toBe('Recipient 2');
      expect(recipients[2].name).toBe('Recipient 3');
    }).toPass();
  });

  test('[AUTO_PLACING_FIELDS]: should automatically create fields from PDF placeholders', async ({
    page,
  }) => {
    const { team } = await setupUserAndSignIn(page);
    const envelopeId = await uploadPdf(page, team, MULTIPLE_PLACEHOLDER_PDF_PATH);

    // V2 editor renders fields on a Konva canvas, so we verify via the database.
    await expect(async () => {
      const fields = await prisma.field.findMany({
        where: { envelopeId },
      });

      const fieldTypes = fields.map((f) => f.type).sort();
      expect(fieldTypes).toEqual(
        ['SIGNATURE', 'SIGNATURE', 'SIGNATURE', 'EMAIL', 'EMAIL', 'NAME', 'TEXT', 'NUMBER'].sort(),
      );
    }).toPass();
  });
});

test.describe('PDF Placeholders without recipient identifier', () => {
  test('[AUTO_PLACING_FIELDS]: should skip placeholders without a recipient identifier', async ({
    page,
  }) => {
    const { team } = await setupUserAndSignIn(page);
    const envelopeId = await uploadPdf(page, team, NO_RECIPIENT_PDF_PATH);

    // Placeholders like {{signature}}, {{name}}, {{email}} have no recipient
    // identifier and should be skipped entirely. No fields or auto-created
    // recipients should exist.
    await expect(async () => {
      const fields = await prisma.field.findMany({
        where: { envelopeId },
      });

      expect(fields).toHaveLength(0);
    }).toPass();
  });

  test('[AUTO_PLACING_FIELDS]: should skip a bare field type placeholder', async ({ page }) => {
    const { team } = await setupUserAndSignIn(page);
    const envelopeId = await uploadPdf(page, team, FIELD_TYPE_ONLY_PDF_PATH);

    await expect(async () => {
      const fields = await prisma.field.findMany({
        where: { envelopeId },
      });

      expect(fields).toHaveLength(0);
    }).toPass();
  });
});

test.describe('PDF Placeholders with invalid field types', () => {
  test('[AUTO_PLACING_FIELDS]: should skip invalid field types and process valid ones', async ({
    page,
  }) => {
    const { team } = await setupUserAndSignIn(page);
    const envelopeId = await uploadPdf(page, team, INVALID_FIELD_TYPE_PDF_PATH);

    // Only the valid placeholders (signature,r1 and email,r2) should create fields.
    // The invalid ones (bogus,r1 and foobar,r2) should be skipped.
    await expect(async () => {
      const fields = await prisma.field.findMany({
        where: { envelopeId },
      });

      const fieldTypes = fields.map((f) => f.type).sort();
      expect(fieldTypes).toEqual(['EMAIL', 'SIGNATURE'].sort());
    }).toPass();

    // Both valid recipients should still be created.
    await expect(async () => {
      const recipients = await prisma.recipient.findMany({
        where: { envelopeId },
        orderBy: { signingOrder: 'asc' },
      });

      expect(recipients).toHaveLength(2);
    }).toPass();
  });
});
