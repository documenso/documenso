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

/**
 * On signing surfaces the custom branding logo must render as a plain image.
 * It must not be wrapped in any link, and the Brand Website must never appear
 * as a link on these pages.
 */
const expectPlainBrandingLogo = async (page: Page, logoName: string) => {
  const logo = page.getByRole('img', { name: logoName });

  await expect(logo).toBeVisible();

  // The custom logo must not be wrapped in a link.
  await expect(page.getByRole('link', { name: logoName })).toHaveCount(0);

  // The Brand Website must never be rendered as a link on signing pages.
  await expect(page.locator(`a[href="${BRANDING_URL}"]`)).toHaveCount(0);
};

test('[SIGNING_BRANDING]: V1 normal signing renders custom logo as a plain image', async ({ page }) => {
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

  await expectPlainBrandingLogo(page, `${team.name}'s Logo`);
});

test('[SIGNING_BRANDING]: V2 signing renders custom logo as a plain image', async ({ page }) => {
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
  await expectPlainBrandingLogo(page, `${team.name}'s Logo`);

  await page.goto(formatDirectTemplatePath(directTemplate.directLink?.token || ''));
  await expectPlainBrandingLogo(page, `${team.name}'s Logo`);
});

test('[SIGNING_BRANDING]: V2 signing keeps internal link for the Documenso fallback logo', async ({ page }) => {
  const { user, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: ['v2-fallback-signer@test.documenso.com'],
    fields: [FieldType.SIGNATURE],
    updateDocumentOptions: { internalVersion: 2 },
  });

  await page.goto(`/sign/${recipients[0].token}`);

  const fallbackLogoLink = page.locator('a[href="/"]').first();

  await expect(fallbackLogoLink).toBeVisible();
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
