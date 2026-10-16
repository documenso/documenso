import { FIELD_SIGNATURE_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import { prisma } from '@documenso/prisma';
import { seedTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { expectToastTextToBeVisible } from '../fixtures/generic';

const seedSignatureFieldForRecipient = async (options: { envelopeId: string; recipientId: number }) => {
  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
    where: { envelopeId: options.envelopeId },
  });

  return await prisma.field.create({
    data: {
      envelopeId: options.envelopeId,
      envelopeItemId: envelopeItem.id,
      recipientId: options.recipientId,
      type: FieldType.SIGNATURE,
      page: 1,
      positionX: 5,
      positionY: 10,
      width: 20,
      height: 5,
      customText: '',
      inserted: false,
      fieldMeta: FIELD_SIGNATURE_META_DEFAULT_VALUES,
    },
  });
};

test('[TEMPLATE_USE]: shows missing signature fields error when sending a template without signature fields', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  // seedTemplate creates one SIGNER recipient and no fields.
  await seedTemplate({
    title: 'Template missing signature fields',
    userId: user.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: 'Use Template' }).click();
  await expect(page.getByRole('heading', { name: 'Create document from template' })).toBeVisible();

  // Enable distribution so the document is sent on creation.
  await page.locator('#distributeDocument').click();
  await page.getByRole('button', { name: 'Create and send' }).click();

  await expectToastTextToBeVisible(page, 'Missing signature fields');
  await expectToastTextToBeVisible(
    page,
    'The document could not be sent because some signers do not have a signature field',
  );
});

test('[TEMPLATE_USE]: creates and sends a document when signers have signature fields', async ({ page }) => {
  const { user, team } = await seedUser();

  const template = await seedTemplate({
    title: 'Template with signature fields',
    userId: user.id,
    teamId: team.id,
  });

  await seedSignatureFieldForRecipient({
    envelopeId: template.id,
    recipientId: template.recipients[0].id,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: 'Use Template' }).click();
  await expect(page.getByRole('heading', { name: 'Create document from template' })).toBeVisible();

  await page.locator('#distributeDocument').click();
  await page.getByRole('button', { name: 'Create and send' }).click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const envelopeId = page.url().split('/').pop()?.split('?')[0];

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: envelopeId },
  });

  expect(envelope.status).toBe(DocumentStatus.PENDING);
});
