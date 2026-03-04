import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { signSignaturePad } from '../fixtures/signature';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

const completeSigningForRecipient = async ({
  page,
  token,
  fields,
}: {
  page: Page;
  token: string;
  fields: { id: number; type: FieldType }[];
}) => {
  const signUrl = `/sign/${token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  for (const field of fields) {
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

test('[DOCUMENT_AUTH]: recipient outside team can open completed PDF via QR share route', async ({
  page,
}) => {
  const { user: owner, team } = await seedUser();
  const { user: outsideRecipientA } = await seedUser();
  const { user: outsideRecipientB } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [outsideRecipientA, outsideRecipientB],
    fields: [FieldType.SIGNATURE],
  });

  const firstRecipient = recipients[0];
  const secondRecipient = recipients[1];

  await completeSigningForRecipient({
    page,
    token: firstRecipient.token,
    fields: firstRecipient.fields,
  });

  await expect(page.getByRole('link', { name: 'View completed PDF' })).not.toBeVisible();

  await completeSigningForRecipient({
    page,
    token: secondRecipient.token,
    fields: secondRecipient.fields,
  });

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('link', { name: 'View completed PDF' })).toBeVisible();
  }).toPass({
    timeout: 30000,
    intervals: [1000, 2000, 3000],
  });

  await page.getByRole('link', { name: 'View completed PDF' }).click();
  await expect(page).toHaveURL(/\/share\/qr_/);
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
});

test('[DOCUMENT_AUTH]: recipient cannot access final view action before full completion', async ({
  page,
}) => {
  const { user: owner, team } = await seedUser();
  const { user: outsideRecipientA } = await seedUser();
  const { user: outsideRecipientB } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [outsideRecipientA, outsideRecipientB],
    fields: [FieldType.SIGNATURE],
  });

  const firstRecipient = recipients[0];

  await completeSigningForRecipient({
    page,
    token: firstRecipient.token,
    fields: firstRecipient.fields,
  });

  await expect(page.getByText('Waiting for others to sign')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View completed PDF' })).not.toBeVisible();
});

test('[DOCUMENT_AUTH]: invalid QR share token is denied', async ({ page }) => {
  await page.goto('/share/qr_invalid_token');

  await expect(page.getByRole('heading', { name: 'Unable to Open Document' })).toBeVisible();
  await expect(page.getByText('Support code:')).toBeVisible();
});

test('[DOCUMENT_AUTH]: disabling public completed-document access revokes QR share access immediately', async ({
  page,
}) => {
  const { user: owner, team } = await seedUser();
  const { user: outsideRecipientA } = await seedUser();
  const { user: outsideRecipientB } = await seedUser();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [outsideRecipientA, outsideRecipientB],
    fields: [FieldType.SIGNATURE],
  });

  await completeSigningForRecipient({
    page,
    token: recipients[0].token,
    fields: recipients[0].fields,
  });

  await completeSigningForRecipient({
    page,
    token: recipients[1].token,
    fields: recipients[1].fields,
  });

  await expect(async () => {
    const envelope = await prisma.envelope.findFirstOrThrow({
      where: {
        id: document.id,
      },
      select: {
        id: true,
        status: true,
        qrToken: true,
      },
    });

    expect(envelope.status).toBe(DocumentStatus.COMPLETED);
    expect(envelope.qrToken).toBeTruthy();
  }).toPass();

  const completedEnvelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: document.id,
    },
    select: {
      qrToken: true,
    },
  });

  const teamSettings = await prisma.teamGlobalSettings.findFirstOrThrow({
    where: {
      team: {
        id: team.id,
      },
    },
  });

  await prisma.teamGlobalSettings.update({
    where: {
      id: teamSettings.id,
    },
    data: {
      allowPublicCompletedDocumentAccess: false,
    },
  });

  await page.goto(`/share/${completedEnvelope.qrToken}`);
  await expect(page.getByRole('heading', { name: 'Unable to Open Document' })).toBeVisible();
  await expect(
    page.getByText('Public completed-document access is currently disabled.'),
  ).toBeVisible();
});
