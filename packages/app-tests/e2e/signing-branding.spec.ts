import fs from 'node:fs/promises';
import path from 'node:path';

import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { DocumentDataType, FieldType } from '@prisma/client';

const BRANDING_URL = 'https://brand.example/signing?source=documenso';
const PDF_PAGE_SELECTOR = 'img[data-page-number]';

const readBrandingLogo = async () => {
  const logo = await fs.readFile(path.join(__dirname, '../../assets/logo.png'));

  return JSON.stringify({
    type: DocumentDataType.BYTES_64,
    data: logo.toString('base64'),
  });
};

const enableOrganisationBranding = async ({
  organisationGlobalSettingsId,
  brandingUrl = BRANDING_URL,
}: {
  organisationGlobalSettingsId: string;
  brandingUrl?: string;
}) => {
  await prisma.organisationGlobalSettings.update({
    where: { id: organisationGlobalSettingsId },
    data: {
      brandingEnabled: true,
      brandingLogo: await readBrandingLogo(),
      brandingUrl,
    },
  });
};

const expectExternalBrandingLink = async (page: Page, logoName: string) => {
  const logoLink = page.getByRole('link', { name: logoName });

  await expect(logoLink).toHaveAttribute('href', BRANDING_URL);
  await expect(logoLink).toHaveAttribute('target', '_blank');
  await expect(logoLink).toHaveAttribute('rel', 'noopener noreferrer');
};

test('[SIGNING_BRANDING]: V1 normal signing links custom logo to safe Brand Website', async ({ page }) => {
  const { user, team, organisation } = await seedUser();

  await enableOrganisationBranding({
    organisationGlobalSettingsId: organisation.organisationGlobalSettingsId,
  });

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: ['v1-branding-signer@test.documenso.com'],
    fields: [FieldType.SIGNATURE],
  });

  await page.goto(`/sign/${recipients[0].token}`);

  await expectExternalBrandingLink(page, `${team.name}'s Logo`);
});

test('[SIGNING_BRANDING]: V2 signing links custom logo to safe Brand Website', async ({ page }) => {
  const { user, team, organisation } = await seedUser();

  await enableOrganisationBranding({
    organisationGlobalSettingsId: organisation.organisationGlobalSettingsId,
  });

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: ['v2-branding-signer@test.documenso.com'],
    fields: [FieldType.SIGNATURE],
    updateDocumentOptions: { internalVersion: 2 },
  });

  const directTemplate = await seedDirectTemplate({
    title: 'V2 Branding Direct Template',
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
  });

  await page.goto(`/sign/${recipients[0].token}`);
  await expectExternalBrandingLink(page, `${team.name}'s Logo`);

  await page.goto(formatDirectTemplatePath(directTemplate.directLink?.token || ''));
  await expectExternalBrandingLink(page, `${team.name}'s Logo`);
});

test('[SIGNING_BRANDING]: V1 and V2 custom logos keep internal link when Brand Website is missing', async ({
  page,
}) => {
  const { user, team, organisation } = await seedUser();

  await enableOrganisationBranding({
    organisationGlobalSettingsId: organisation.organisationGlobalSettingsId,
    brandingUrl: '',
  });

  const { recipients: recipientsV1 } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: ['v1-branding-no-url-signer@test.documenso.com'],
    fields: [FieldType.SIGNATURE],
  });

  const { recipients: recipientsV2 } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: ['v2-branding-no-url-signer@test.documenso.com'],
    fields: [FieldType.SIGNATURE],
    updateDocumentOptions: { internalVersion: 2 },
  });

  await page.goto(`/sign/${recipientsV1[0].token}`);

  const logoLinkV1 = page.getByRole('link', { name: `${team.name}'s Logo` });

  await expect(logoLinkV1).toHaveAttribute('href', '/');
  await expect(logoLinkV1).not.toHaveAttribute('target', '_blank');

  await page.goto(`/sign/${recipientsV2[0].token}`);

  const logoLinkV2 = page.getByRole('link', { name: `${team.name}'s Logo` });

  await expect(logoLinkV2).toHaveAttribute('href', '/');
  await expect(logoLinkV2).not.toHaveAttribute('target', '_blank');
});

test('[SIGNING_BRANDING]: embedded signing does not render custom logo Brand Website links', async ({ page }) => {
  const { user, team, organisation } = await seedUser();

  await enableOrganisationBranding({
    organisationGlobalSettingsId: organisation.organisationGlobalSettingsId,
  });

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: ['embed-branding-signer@test.documenso.com'],
    fields: [FieldType.SIGNATURE],
    updateDocumentOptions: { internalVersion: 2 },
  });

  await page.goto(`/embed/sign/${recipients[0].token}`);
  await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

  await expect(page.locator(`a[href="${BRANDING_URL}"]`)).toHaveCount(0);
  await expect(page.getByRole('link', { name: `${team.name}'s Logo` })).toHaveCount(0);
});
