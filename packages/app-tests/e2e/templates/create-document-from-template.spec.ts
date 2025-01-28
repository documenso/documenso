import { expect, test } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { DocumentDataType, TeamMemberRole } from '@documenso/prisma/client';
import { seedUserSubscription } from '@documenso/prisma/seed/subscriptions';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

const enterprisePriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PLAN_MONTHLY_PRICE_ID || '';

// Create a temporary PDF file for testing
function createTempPdfFile() {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, 'test.pdf');

  // Create a simple PDF file with some content
  const pdfContent = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF',
  );

  fs.writeFileSync(tempFilePath, new Uint8Array(pdfContent));
  return tempFilePath;
}

/**
 * 1. Create a template with all settings filled out
 * 2. Create a document from the template
 * 3. Ensure all values are correct
 *
 * Note: There is a direct copy paste of this test below for teams.
 *
 * If you update this test please update that test as well.
 */
test('[TEMPLATE]: should create a document from a template', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  const isBillingEnabled =
    process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED === 'true' && enterprisePriceId;

  await seedUserSubscription({
    userId: user.id,
    priceId: enterprisePriceId,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  // Set template title.
  await page.getByLabel('Title').fill('TEMPLATE_TITLE');

  // Set template document access.
  await page.getByTestId('documentAccessSelectValue').click();
  await page.getByLabel('Require account').getByText('Require account').click();
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  // Set EE action auth.
  if (isBillingEnabled) {
    await page.getByTestId('documentActionSelectValue').click();
    await page.getByLabel('Require passkey').getByText('Require passkey').click();
    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');
  }

  // Set email options.
  await page.getByRole('button', { name: 'Email Options' }).click();
  await page.getByLabel('Subject (Optional)').fill('SUBJECT');
  await page.getByLabel('Message (Optional)').fill('MESSAGE');

  // Set advanced options.
  await page.getByRole('button', { name: 'Advanced Options' }).click();
  await page.locator('button').filter({ hasText: 'YYYY-MM-DD HH:mm a' }).click();
  await page.getByLabel('DD/MM/YYYY').click();

  await page.locator('.time-zone-field').click();
  await page.getByRole('option', { name: 'Etc/UTC' }).click();
  await page.getByLabel('Redirect URL').fill('https://documenso.com');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

  // Add 2 signers.
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
  await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

  // Apply require passkey for Recipient 1.
  if (isBillingEnabled) {
    await page.getByLabel('Show advanced settings').check();
    await page.getByRole('combobox').first().click();
    await page.getByLabel('Require passkey').click();
  }

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Save template' }).click();

  // Use template
  await page.waitForURL('/templates');
  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the correct values.
  await page.waitForURL(/documents/);

  const documentId = Number(page.url().split('/').pop());

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  const documentAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  expect(document.title).toEqual('TEMPLATE_TITLE');
  expect(documentAuth.documentAuthOption.globalAccessAuth).toEqual('ACCOUNT');
  expect(documentAuth.documentAuthOption.globalActionAuth).toEqual(
    isBillingEnabled ? 'PASSKEY' : null,
  );
  expect(document.documentMeta?.dateFormat).toEqual('dd/MM/yyyy hh:mm a');
  expect(document.documentMeta?.message).toEqual('MESSAGE');
  expect(document.documentMeta?.redirectUrl).toEqual('https://documenso.com');
  expect(document.documentMeta?.subject).toEqual('SUBJECT');
  expect(document.documentMeta?.timezone).toEqual('Etc/UTC');

  const recipientOne = document.recipients[0];
  const recipientTwo = document.recipients[1];

  const recipientOneAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipientOne.authOptions,
  });

  const recipientTwoAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipientTwo.authOptions,
  });

  if (isBillingEnabled) {
    expect(recipientOneAuth.derivedRecipientActionAuth).toEqual('PASSKEY');
  }

  expect(recipientOneAuth.derivedRecipientAccessAuth).toEqual('ACCOUNT');
  expect(recipientTwoAuth.derivedRecipientAccessAuth).toEqual('ACCOUNT');
});

/**
 * This is a direct copy paste of the above test but for teams.
 */
test('[TEMPLATE]: should create a team document from a team template', async ({ page }) => {
  const { owner, ...team } = await seedTeam({
    createTeamMembers: 2,
  });

  const template = await seedBlankTemplate(owner, {
    createTemplateOptions: {
      teamId: team.id,
    },
  });

  const isBillingEnabled =
    process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED === 'true' && enterprisePriceId;

  await seedUserSubscription({
    userId: owner.id,
    priceId: enterprisePriceId,
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  // Set template title.
  await page.getByLabel('Title').fill('TEMPLATE_TITLE');

  // Set template document access.
  await page.getByTestId('documentAccessSelectValue').click();
  await page.getByLabel('Require account').getByText('Require account').click();
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  // Set EE action auth.
  if (isBillingEnabled) {
    await page.getByTestId('documentActionSelectValue').click();
    await page.getByLabel('Require passkey').getByText('Require passkey').click();
    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');
  }

  // Set email options.
  await page.getByRole('button', { name: 'Email Options' }).click();
  await page.getByLabel('Subject (Optional)').fill('SUBJECT');
  await page.getByLabel('Message (Optional)').fill('MESSAGE');

  // Set advanced options.
  await page.getByRole('button', { name: 'Advanced Options' }).click();
  await page.locator('button').filter({ hasText: 'YYYY-MM-DD HH:mm a' }).click();
  await page.getByLabel('DD/MM/YYYY').click();

  await page.locator('.time-zone-field').click();
  await page.getByRole('option', { name: 'Etc/UTC' }).click();
  await page.getByLabel('Redirect URL').fill('https://documenso.com');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

  // Add 2 signers.
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
  await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

  // Apply require passkey for Recipient 1.
  if (isBillingEnabled) {
    await page.getByLabel('Show advanced settings').check();
    await page.getByRole('combobox').first().click();
    await page.getByLabel('Require passkey').click();
  }

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Save template' }).click();

  // Use template
  await page.waitForURL(`/t/${team.url}/templates`);
  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the correct values.
  await page.waitForURL(/documents/);

  const documentId = Number(page.url().split('/').pop());

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  expect(document.teamId).toEqual(team.id);

  const documentAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  expect(document.title).toEqual('TEMPLATE_TITLE');
  expect(documentAuth.documentAuthOption.globalAccessAuth).toEqual('ACCOUNT');
  expect(documentAuth.documentAuthOption.globalActionAuth).toEqual(
    isBillingEnabled ? 'PASSKEY' : null,
  );
  expect(document.documentMeta?.dateFormat).toEqual('dd/MM/yyyy hh:mm a');
  expect(document.documentMeta?.message).toEqual('MESSAGE');
  expect(document.documentMeta?.redirectUrl).toEqual('https://documenso.com');
  expect(document.documentMeta?.subject).toEqual('SUBJECT');
  expect(document.documentMeta?.timezone).toEqual('Etc/UTC');

  const recipientOne = document.recipients[0];
  const recipientTwo = document.recipients[1];

  const recipientOneAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipientOne.authOptions,
  });

  const recipientTwoAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipientTwo.authOptions,
  });

  if (isBillingEnabled) {
    expect(recipientOneAuth.derivedRecipientActionAuth).toEqual('PASSKEY');
  }

  expect(recipientOneAuth.derivedRecipientAccessAuth).toEqual('ACCOUNT');
  expect(recipientTwoAuth.derivedRecipientAccessAuth).toEqual('ACCOUNT');
});

/**
 * This test verifies that we can create a document from a template using a custom document
 * instead of the template's default document.
 */
test('[TEMPLATE]: should create a document from a template with custom document', async ({
  page,
}) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  // Create a temporary PDF file for upload
  const testPdfPath = createTempPdfFile();
  const pdfContent = fs.readFileSync(testPdfPath).toString('base64');

  try {
    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/templates/${template.id}/edit`,
    });

    // Set template title
    await page.getByLabel('Title').fill('TEMPLATE_WITH_CUSTOM_DOC');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

    // Add a signer
    await page.getByPlaceholder('Email').fill('recipient@documenso.com');
    await page.getByPlaceholder('Name').fill('Recipient');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Save template' }).click();

    // Use template with custom document
    await page.waitForURL('/templates');
    await page.getByRole('button', { name: 'Use Template' }).click();

    // Enable custom document upload and upload file
    await page.getByLabel('Upload custom document').check();
    await page.locator('input[type="file"]').setInputFiles(testPdfPath);

    // Wait for upload to complete
    await expect(page.getByText(path.basename(testPdfPath))).toBeVisible();

    // Create document with custom document data
    await page.getByRole('button', { name: 'Create as draft' }).click();

    // Review that the document was created with the custom document data
    await page.waitForURL(/documents/);

    const documentId = Number(page.url().split('/').pop());

    const document = await prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
      },
      include: {
        documentData: true,
      },
    });

    expect(document.title).toEqual('TEMPLATE_WITH_CUSTOM_DOC');
    expect(document.documentData.type).toEqual(DocumentDataType.BYTES_64);
    expect(document.documentData.data).toEqual(pdfContent);
    expect(document.documentData.initialData).toEqual(pdfContent);
  } finally {
    // Clean up the temporary file
    fs.unlinkSync(testPdfPath);
  }
});

/**
 * This test verifies that we can create a team document from a template using a custom document
 * instead of the template's default document.
 */
test('[TEMPLATE]: should create a team document from a template with custom document', async ({
  page,
}) => {
  const { owner, ...team } = await seedTeam({
    createTeamMembers: 2,
  });

  const template = await seedBlankTemplate(owner, {
    createTemplateOptions: {
      teamId: team.id,
    },
  });

  // Create a temporary PDF file for upload
  const testPdfPath = createTempPdfFile();
  const pdfContent = fs.readFileSync(testPdfPath).toString('base64');

  try {
    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
    });

    // Set template title
    await page.getByLabel('Title').fill('TEAM_TEMPLATE_WITH_CUSTOM_DOC');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

    // Add a signer
    await page.getByPlaceholder('Email').fill('recipient@documenso.com');
    await page.getByPlaceholder('Name').fill('Recipient');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Save template' }).click();

    // Use template with custom document
    await page.waitForURL(`/t/${team.url}/templates`);
    await page.getByRole('button', { name: 'Use Template' }).click();

    // Enable custom document upload and upload file
    await page.getByLabel('Upload custom document').check();
    await page.locator('input[type="file"]').setInputFiles(testPdfPath);

    // Wait for upload to complete
    await expect(page.getByText(path.basename(testPdfPath))).toBeVisible();

    // Create document with custom document data
    await page.getByRole('button', { name: 'Create as draft' }).click();

    // Review that the document was created with the custom document data
    await page.waitForURL(/documents/);

    const documentId = Number(page.url().split('/').pop());

    const document = await prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
      },
      include: {
        documentData: true,
      },
    });

    expect(document.teamId).toEqual(team.id);
    expect(document.title).toEqual('TEAM_TEMPLATE_WITH_CUSTOM_DOC');
    expect(document.documentData.type).toEqual(DocumentDataType.BYTES_64);
    expect(document.documentData.data).toEqual(pdfContent);
    expect(document.documentData.initialData).toEqual(pdfContent);
  } finally {
    // Clean up the temporary file
    fs.unlinkSync(testPdfPath);
  }
});

/**
 * This test verifies that when custom document upload is not enabled,
 * the document uses the template's original document data.
 */
test('[TEMPLATE]: should create a document from a template using template document when custom document is not enabled', async ({
  page,
}) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  // Set template title
  await page.getByLabel('Title').fill('TEMPLATE_WITH_ORIGINAL_DOC');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

  // Add a signer
  await page.getByPlaceholder('Email').fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Save template' }).click();

  // Use template without custom document
  await page.waitForURL('/templates');
  await page.getByRole('button', { name: 'Use Template' }).click();

  // Verify custom document upload is not checked by default
  await expect(page.getByLabel('Upload custom document')).not.toBeChecked();

  // Create document without custom document data
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the template's document data
  await page.waitForURL(/documents/);

  const documentId = Number(page.url().split('/').pop());

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      documentData: true,
    },
  });

  const templateWithData = await prisma.template.findFirstOrThrow({
    where: {
      id: template.id,
    },
    include: {
      templateDocumentData: true,
    },
  });

  expect(document.title).toEqual('TEMPLATE_WITH_ORIGINAL_DOC');
  expect(document.documentData.data).toEqual(templateWithData.templateDocumentData.data);
  expect(document.documentData.initialData).toEqual(
    templateWithData.templateDocumentData.initialData,
  );
  expect(document.documentData.type).toEqual(templateWithData.templateDocumentData.type);
});

test('[TEMPLATE]: should persist document visibility when creating from template', async ({
  page,
}) => {
  const { owner, ...team } = await seedTeam({
    createTeamMembers: 2,
  });

  const template = await seedBlankTemplate(owner, {
    createTemplateOptions: {
      teamId: team.id,
    },
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  // Set template title and visibility
  await page.getByLabel('Title').fill('TEMPLATE_WITH_VISIBILITY');
  await page.getByTestId('documentVisibilitySelectValue').click();
  await page.getByLabel('Managers and above').click();
  await expect(page.getByTestId('documentVisibilitySelectValue')).toContainText(
    'Managers and above',
  );

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

  // Add a signer
  await page.getByPlaceholder('Email').fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Save template' }).click();

  // Test creating document as team manager
  await prisma.teamMember.update({
    where: {
      id: team.members[1].id,
    },
    data: {
      role: TeamMemberRole.MANAGER,
    },
  });

  const managerUser = team.members[1].user;

  await apiSignin({
    page,
    email: managerUser.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the correct visibility
  await page.waitForURL(/documents/);

  const documentId = Number(page.url().split('/').pop());

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
  });

  expect(document.title).toEqual('TEMPLATE_WITH_VISIBILITY');
  expect(document.visibility).toEqual('MANAGER_AND_ABOVE');
  expect(document.teamId).toEqual(team.id);

  // Test that regular member cannot create document from restricted template
  const memberUser = team.members[2].user;
  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  // Template should not be visible to regular member
  await expect(page.getByRole('button', { name: 'Use Template' })).not.toBeVisible();
});
