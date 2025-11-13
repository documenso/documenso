import { expect, test } from '@playwright/test';
import { DocumentDataType, TeamMemberRole } from '@prisma/client';
import path from 'path';

import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

const EXAMPLE_PDF_PATH = path.join(__dirname, '../../../../assets/example.pdf');
const FIELD_ALIGNMENT_TEST_PDF_PATH = path.join(
  __dirname,
  '../../../../assets/field-font-alignment.pdf',
);

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
  const { user, team } = await seedUser();
  const template = await seedBlankTemplate(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  // Set template title.
  await page.getByLabel('Title').fill('TEMPLATE_TITLE');

  // Set template document access.
  await page.getByTestId('documentAccessSelectValue').click();
  await page.getByRole('option').filter({ hasText: 'Require account' }).click();
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  // Set email options.
  await page.getByRole('button', { name: 'Email Options' }).click();
  await page.getByLabel('Subject (Optional)').fill('SUBJECT');
  await page.getByLabel('Message (Optional)').fill('MESSAGE');

  // Set advanced options.
  await page.getByRole('button', { name: 'Advanced Options' }).click();
  await page.locator('button').filter({ hasText: 'YYYY-MM-DD hh:mm AM/PM' }).click();
  await page.getByLabel('DD/MM/YYYY HH:mm', { exact: true }).click();

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

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Save template' }).click();

  // Use template
  await page.waitForURL(`/t/${team.url}/templates`);
  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the correct values.
  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const documentId = page.url().split('/').pop();

  const document = await prisma.envelope.findFirstOrThrow({
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
  expect(documentAuth.documentAuthOption.globalAccessAuth).toContain('ACCOUNT');

  expect(document.documentMeta?.dateFormat).toEqual('dd/MM/yyyy HH:mm');
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

  expect(recipientOneAuth.derivedRecipientAccessAuth).toContain('ACCOUNT');
  expect(recipientTwoAuth.derivedRecipientAccessAuth).toContain('ACCOUNT');
});

/**
 * This is a direct copy paste of the above test but for teams.
 */
test('[TEMPLATE]: should create a team document from a team template', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 2,
  });

  const template = await seedBlankTemplate(owner, team.id);

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  // Set template title.
  await page.getByLabel('Title').fill('TEMPLATE_TITLE');

  // Set template document access.
  await page.getByTestId('documentAccessSelectValue').click();
  await page.getByRole('option').filter({ hasText: 'Require account' }).click();
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  // Set email options.
  await page.getByRole('button', { name: 'Email Options' }).click();
  await page.getByLabel('Subject (Optional)').fill('SUBJECT');
  await page.getByLabel('Message (Optional)').fill('MESSAGE');

  // Set advanced options.
  await page.getByRole('button', { name: 'Advanced Options' }).click();
  await page.locator('button').filter({ hasText: 'YYYY-MM-DD hh:mm AM/PM' }).click();
  await page.getByLabel('DD/MM/YYYY HH:mm', { exact: true }).click();

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

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Save template' }).click();

  // Use template
  await page.waitForURL(`/t/${team.url}/templates`);
  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the correct values.
  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const documentId = page.url().split('/').pop();

  const document = await prisma.envelope.findFirstOrThrow({
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
  expect(documentAuth.documentAuthOption.globalAccessAuth).toContain('ACCOUNT');
  expect(document.documentMeta?.dateFormat).toEqual('dd/MM/yyyy HH:mm');
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

  expect(recipientOneAuth.derivedRecipientAccessAuth).toContain('ACCOUNT');
  expect(recipientTwoAuth.derivedRecipientAccessAuth).toContain('ACCOUNT');
});

/**
 * This test verifies that we can create a document from a template using a custom document
 * instead of the template's default document.
 */
test('[TEMPLATE]: should create a document from a template with custom document', async ({
  page,
}) => {
  const { user, team } = await seedUser();
  const template = await seedBlankTemplate(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
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
  await page.waitForURL(`/t/${team.url}/templates`);
  await page.getByRole('button', { name: 'Use Template' }).click();

  // Enable custom document upload and upload file
  await page.getByLabel('Upload custom document').check();

  // Upload document.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .locator(`#template-use-dialog-file-input-${template.envelopeItems[0].id}`)
      .evaluate((e) => {
        if (e instanceof HTMLInputElement) {
          e.click();
        }
      }),
  ]);

  await fileChooser.setFiles(FIELD_ALIGNMENT_TEST_PDF_PATH);

  // Wait for upload to complete
  await expect(page.getByText('Remove')).toBeVisible();

  // Create document with custom document data
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the custom document data
  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const documentId = page.url().split('/').pop();

  const document = await prisma.envelope.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
    },
  });

  const firstDocumentData = document.envelopeItems[0].documentData;

  const expectedDocumentDataType =
    process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT === 's3'
      ? DocumentDataType.S3_PATH
      : DocumentDataType.BYTES_64;

  expect(document.title).toEqual('TEMPLATE_WITH_CUSTOM_DOC');
  expect(firstDocumentData.type).toEqual(expectedDocumentDataType);

  if (expectedDocumentDataType === DocumentDataType.BYTES_64) {
    // Todo: Doesn't really work due to normalization of the PDF which won't let us directly compare the data.
    // Probably need to do a pixel match
    expect(firstDocumentData.data).not.toEqual(template.envelopeItems[0].documentData.data);
    expect(firstDocumentData.initialData).not.toEqual(
      template.envelopeItems[0].documentData.initialData,
    );
  } else {
    // For S3, we expect the data/initialData to be the S3 path (non-empty string)
    expect(firstDocumentData.data).toBeTruthy();
    expect(firstDocumentData.initialData).toBeTruthy();
  }
});

/**
 * This test verifies that we can create a team document from a template using a custom document
 * instead of the template's default document.
 */
test('[TEMPLATE]: should create a team document from a template with custom document', async ({
  page,
}) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 2,
  });

  const template = await seedBlankTemplate(owner, team.id);

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

  // Upload document.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .locator(`#template-use-dialog-file-input-${template.envelopeItems[0].id}`)
      .evaluate((e) => {
        if (e instanceof HTMLInputElement) {
          e.click();
        }
      }),
  ]);

  await fileChooser.setFiles(FIELD_ALIGNMENT_TEST_PDF_PATH);

  // Wait for upload to complete
  await expect(page.getByText('Remove')).toBeVisible();

  // Create document with custom document data
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the custom document data
  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const documentId = page.url().split('/').pop();

  const document = await prisma.envelope.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
    },
  });

  const expectedDocumentDataType =
    process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT === 's3'
      ? DocumentDataType.S3_PATH
      : DocumentDataType.BYTES_64;

  const firstDocumentData = document.envelopeItems[0].documentData;

  expect(document.teamId).toEqual(team.id);
  expect(document.title).toEqual('TEAM_TEMPLATE_WITH_CUSTOM_DOC');
  expect(firstDocumentData.type).toEqual(expectedDocumentDataType);

  if (expectedDocumentDataType === DocumentDataType.BYTES_64) {
    // Todo: Doesn't really work due to normalization of the PDF which won't let us directly compare the data.
    // Probably need to do a pixel match
    expect(firstDocumentData.data).not.toEqual(template.envelopeItems[0].documentData.data);
    expect(firstDocumentData.initialData).not.toEqual(
      template.envelopeItems[0].documentData.initialData,
    );
  } else {
    // For S3, we expect the data/initialData to be the S3 path (non-empty string)
    expect(firstDocumentData.data).toBeTruthy();
    expect(firstDocumentData.initialData).toBeTruthy();
  }
});

/**
 * This test verifies that when custom document upload is not enabled,
 * the document uses the template's original document data.
 */
test('[TEMPLATE]: should create a document from a template using template document when custom document is not enabled', async ({
  page,
}) => {
  const { user, team } = await seedUser();
  const template = await seedBlankTemplate(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
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
  await page.waitForURL(`/t/${team.url}/templates`);
  await page.getByRole('button', { name: 'Use Template' }).click();

  // Verify custom document upload is not checked by default
  await expect(page.getByLabel('Upload custom document')).not.toBeChecked();

  // Create document without custom document data
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the template's document data
  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const documentId = page.url().split('/').pop();

  const document = await prisma.envelope.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
    },
  });

  const firstDocumentData = document.envelopeItems[0].documentData;

  const templateWithData = await prisma.envelope.findFirstOrThrow({
    where: {
      id: template.id,
    },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
    },
  });

  expect(document.title).toEqual('TEMPLATE_WITH_ORIGINAL_DOC');
  expect(firstDocumentData.data).toEqual(templateWithData.envelopeItems[0].documentData.data);
  expect(firstDocumentData.initialData).toEqual(
    templateWithData.envelopeItems[0].documentData.initialData,
  );
  expect(firstDocumentData.type).toEqual(templateWithData.envelopeItems[0].documentData.type);
});

test('[TEMPLATE]: should persist document visibility when creating from template', async ({
  page,
}) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 2,
  });

  const template = await seedBlankTemplate(owner, team.id);

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
  const managerUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MANAGER,
  });

  await apiSignin({
    page,
    email: managerUser.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the correct visibility
  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const documentId = page.url().split('/').pop();

  const document = await prisma.envelope.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
    },
  });

  expect(document.title).toEqual('TEMPLATE_WITH_VISIBILITY');
  expect(document.visibility).toEqual('MANAGER_AND_ABOVE');
  expect(document.teamId).toEqual(team.id);

  // Test that regular member cannot create document from restricted template
  const memberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  // Template should not be visible to regular member
  await expect(page.getByRole('button', { name: 'Use Template' })).not.toBeVisible();
});
