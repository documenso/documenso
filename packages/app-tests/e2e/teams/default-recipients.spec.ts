import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, RecipientRole } from '@documenso/prisma/client';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';

import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({ mode: 'parallel' });

/**
 * Helper function to set default recipients for a team
 */
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

test.describe('Default Recipients', () => {
  test('[DEFAULT_RECIPIENTS]: default recipients are added to documents created via UI', async ({
    page,
  }) => {
    const { team, owner } = await seedTeam({
      createTeamMembers: 2,
    });

    // Get a team member to set as default recipient
    const teamMembers = await prisma.organisationMember.findMany({
      where: {
        organisationId: team.organisationId,
        userId: {
          not: owner.id,
        },
      },
      include: {
        user: true,
      },
    });

    const defaultRecipientUser = teamMembers[0].user;

    // Set up default recipients for the team
    await setTeamDefaultRecipients(team.id, [
      {
        email: defaultRecipientUser.email,
        name: defaultRecipientUser.name || defaultRecipientUser.email,
        role: RecipientRole.CC,
      },
    ]);

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Upload document via UI - this triggers document creation with default recipients
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

    await fileChooser.setFiles(path.join(__dirname, '../../../../assets/example.pdf'));

    // Wait to be redirected to the edit page (v2 envelope editor)
    await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

    // Extract document ID from URL
    const urlParts = page.url().split('/');
    const documentId = urlParts.find((part) => part.startsWith('envelope_'));

    // Wait for the Recipients card to be visible (v2 envelope editor)
    await expect(page.getByRole('heading', { name: 'Recipients' })).toBeVisible();

    await expect(page.getByTestId('signer-email-input').first()).not.toBeEmpty();

    await page.getByRole('button', { name: 'Add Signer' }).click();

    // Add a regular signer using the v2 editor
    await page.getByTestId('signer-email-input').last().fill('regular-signer@documenso.com');
    await page
      .getByPlaceholder(/Recipient/)
      .first()
      .fill('Regular Signer');

    // Wait for autosave to complete
    await page.waitForTimeout(3000);

    // Verify that default recipient is present in the database
    await expect(async () => {
      const envelope = await prisma.envelope.findFirstOrThrow({
        where: {
          id: documentId,
        },
        include: {
          recipients: true,
        },
      });

      // Should have 2 recipients: the regular signer + the default recipient
      expect(envelope.recipients.length).toBe(2);

      const defaultRecipient = envelope.recipients.find(
        (r) => r.email.toLowerCase() === defaultRecipientUser.email.toLowerCase(),
      );
      expect(defaultRecipient).toBeDefined();
      expect(defaultRecipient?.role).toBe(RecipientRole.CC);

      const regularSigner = envelope.recipients.find(
        (r) => r.email === 'regular-signer@documenso.com',
      );
      expect(regularSigner).toBeDefined();
    }).toPass();
  });

  // TODO: Are we intending to allow default recipients to be removed from a document?
  test.skip('[DEFAULT_RECIPIENTS]: default recipients cannot be removed from a document', async ({
    page,
  }) => {
    const { team, owner } = await seedTeam({
      createTeamMembers: 2,
    });

    // Get a team member to set as default recipient
    const teamMembers = await prisma.organisationMember.findMany({
      where: {
        organisationId: team.organisationId,
        userId: {
          not: owner.id,
        },
      },
      include: {
        user: true,
      },
    });

    const defaultRecipientUser = teamMembers[0].user;

    // Set up default recipients for the team
    await setTeamDefaultRecipients(team.id, [
      {
        email: defaultRecipientUser.email,
        name: defaultRecipientUser.name || defaultRecipientUser.email,
        role: RecipientRole.CC,
      },
    ]);

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Upload document via UI - this triggers document creation with default recipients
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

    await fileChooser.setFiles(path.join(__dirname, '../../../../assets/example.pdf'));

    // Wait to be redirected to the edit page (v2 envelope editor)
    await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

    // Extract document ID from URL
    const urlParts = page.url().split('/');
    const documentId = urlParts.find((part) => part.startsWith('envelope_'));

    // Replace the default recipient with a regular signer
    await page.getByTestId('signer-email-input').first().fill('regular-signer@documenso.com');
    await page
      .getByPlaceholder(/Recipient/)
      .first()
      .fill('Regular Signer');

    // Wait for autosave to complete
    await page.waitForTimeout(3000);

    // Wait for recipients to be saved
    await expect(async () => {
      const envelope = await prisma.envelope.findFirstOrThrow({
        where: {
          id: documentId,
        },
        include: {
          recipients: true,
        },
      });
      expect(envelope.recipients.length).toBe(2);
    }).toPass();

    // Verify that the default recipient's remove button is disabled
    // In the v2 editor, default recipients should have a disabled remove button
    // Find the fieldset containing the default recipient's email and check if its remove button is disabled
    const defaultRecipientRow = page.locator('fieldset').filter({
      hasText: defaultRecipientUser.email,
    });

    // The default recipient row should exist and have a disabled remove button
    await expect(defaultRecipientRow).toHaveCount(1);
    const removeButton = defaultRecipientRow.getByTestId('remove-signer-button');
    await expect(removeButton).toBeDisabled();
  });

  test('[DEFAULT_RECIPIENTS]: documents created via API have default recipients', async ({
    request,
  }) => {
    const { team, owner } = await seedTeam({
      createTeamMembers: 2,
    });

    // Get a team member to set as default recipient
    const teamMembers = await prisma.organisationMember.findMany({
      where: {
        organisationId: team.organisationId,
        userId: {
          not: owner.id,
        },
      },
      include: {
        user: true,
      },
    });

    const defaultRecipientUser = teamMembers[0].user;

    // Set up default recipients for the team
    await setTeamDefaultRecipients(team.id, [
      {
        email: defaultRecipientUser.email,
        name: defaultRecipientUser.name || defaultRecipientUser.email,
        role: RecipientRole.CC,
      },
    ]);

    // Create API token
    const { token } = await createApiToken({
      userId: owner.id,
      teamId: team.id,
      tokenName: 'test-token',
      expiresIn: null,
    });

    // Create envelope via API
    const payload: TCreateEnvelopePayload = {
      type: EnvelopeType.DOCUMENT,
      title: 'Test Document with Default Recipients',
      recipients: [
        {
          email: 'api-recipient@documenso.com',
          name: 'API Recipient',
          role: RecipientRole.SIGNER,
        },
      ],
    };

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));

    const pdfData = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));
    formData.append('files', new File([pdfData], 'test.pdf', { type: 'application/pdf' }));

    const res = await request.post(`${baseUrl}/envelope/create`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const response = (await res.json()) as TCreateEnvelopeResponse;

    // Verify the envelope has both the API recipient and the default recipient
    const envelope = await prisma.envelope.findUniqueOrThrow({
      where: {
        id: response.id,
      },
      include: {
        recipients: true,
      },
    });

    expect(envelope.recipients.length).toBe(2);

    const apiRecipient = envelope.recipients.find((r) => r.email === 'api-recipient@documenso.com');
    expect(apiRecipient).toBeDefined();
    expect(apiRecipient?.role).toBe(RecipientRole.SIGNER);

    const defaultRecipient = envelope.recipients.find(
      (r) => r.email.toLowerCase() === defaultRecipientUser.email.toLowerCase(),
    );
    expect(defaultRecipient).toBeDefined();
    expect(defaultRecipient?.role).toBe(RecipientRole.CC);
  });

  test('[DEFAULT_RECIPIENTS]: documents created from template have default recipients', async ({
    page,
  }) => {
    const { team, owner } = await seedTeam({
      createTeamMembers: 2,
    });

    // Get a team member to set as default recipient
    const teamMembers = await prisma.organisationMember.findMany({
      where: {
        organisationId: team.organisationId,
        userId: {
          not: owner.id,
        },
      },
      include: {
        user: true,
      },
    });

    const defaultRecipientUser = teamMembers[0].user;

    // Set up default recipients for the team
    await setTeamDefaultRecipients(team.id, [
      {
        email: defaultRecipientUser.email,
        name: defaultRecipientUser.name || defaultRecipientUser.email,
        role: RecipientRole.CC,
      },
    ]);

    // Create a template
    const template = await seedBlankTemplate(owner, team.id);

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
    });

    // Set template title
    await page.getByLabel('Title').fill('Template with Default Recipients');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

    // Add a template recipient
    await page.getByPlaceholder('Email').fill('template-recipient@documenso.com');
    await page.getByPlaceholder('Name').fill('Template Recipient');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

    await page.getByRole('button', { name: 'Save template' }).click();

    // Use template to create document
    await page.waitForURL(`/t/${team.url}/templates`);
    await page.getByRole('button', { name: 'Use Template' }).click();
    await page.getByRole('button', { name: 'Create as draft' }).click();

    // Wait for document to be created
    await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

    const documentId = page.url().split('/').pop();

    // Verify the document has both the template recipient and the default recipient
    const document = await prisma.envelope.findFirstOrThrow({
      where: {
        id: documentId,
      },
      include: {
        recipients: true,
      },
    });

    expect(document.recipients.length).toBe(2);

    const templateRecipient = document.recipients.find(
      (r) => r.email === 'template-recipient@documenso.com',
    );
    expect(templateRecipient).toBeDefined();

    const defaultRecipient = document.recipients.find(
      (r) => r.email.toLowerCase() === defaultRecipientUser.email.toLowerCase(),
    );
    expect(defaultRecipient).toBeDefined();
    expect(defaultRecipient?.role).toBe(RecipientRole.CC);
  });
});
