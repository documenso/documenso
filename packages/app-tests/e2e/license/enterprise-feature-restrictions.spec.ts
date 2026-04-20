import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { TCachedLicense, TLicenseClaim } from '@documenso/lib/types/license';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

const LICENSE_FILE_NAME = '.documenso-license.json';
const LICENSE_BACKUP_FILE_NAME = '.documenso-license-backup.json';

/**
 * Get the path to the license file.
 *
 * The server reads from process.cwd() which is apps/remix when the dev server runs.
 * Tests run from packages/app-tests, so we need to go up to the root then into apps/remix.
 */
const getLicenseFilePath = () => {
  // From packages/app-tests/e2e/license -> ../../../../apps/remix/.documenso-license.json
  return path.join(__dirname, '../../../../apps/remix', LICENSE_FILE_NAME);
};

/**
 * Get the path to the backup license file.
 */
const getBackupLicenseFilePath = () => {
  return path.join(__dirname, '../../../../apps/remix', LICENSE_BACKUP_FILE_NAME);
};

/**
 * Backup the existing license file if it exists.
 */
const backupLicenseFile = async () => {
  const licensePath = getLicenseFilePath();
  const backupPath = getBackupLicenseFilePath();

  try {
    await fs.access(licensePath);
    await fs.rename(licensePath, backupPath);
  } catch (e) {
    // File doesn't exist, nothing to backup
    console.log(e);
  }
};

/**
 * Restore the backup license file if it exists.
 */
const restoreLicenseFile = async () => {
  const licensePath = getLicenseFilePath();
  const backupPath = getBackupLicenseFilePath();

  try {
    await fs.access(backupPath);
    await fs.rename(backupPath, licensePath);
  } catch (e) {
    // Backup doesn't exist, nothing to restore
    console.log(e);
  }
};

/**
 * Write a license file with the given data.
 * Pass null to delete the license file.
 */
const writeLicenseFile = async (data: TCachedLicense | null) => {
  const licensePath = getLicenseFilePath();

  if (data === null) {
    await fs.unlink(licensePath).catch(() => {
      // File doesn't exist, ignore
    });
  } else {
    await fs.writeFile(licensePath, JSON.stringify(data, null, 2), 'utf-8');
  }
};

/**
 * Create a mock license object with the given flags.
 */
const createMockLicenseWithFlags = (flags: TLicenseClaim): TCachedLicense => {
  return {
    lastChecked: new Date().toISOString(),
    license: {
      status: 'ACTIVE',
      createdAt: new Date(),
      name: 'Test License',
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      cancelAtPeriodEnd: false,
      licenseKey: 'test-license-key',
      flags,
    },
    requestedLicenseKey: 'test-license-key',
    derivedStatus: 'ACTIVE',
    unauthorizedFlagUsage: false,
  };
};

// Run tests serially to avoid race conditions with the license file
test.describe.configure({ mode: 'serial' });

// SKIPPING TEST UNTIL WE ADD A WAY TO OVERRIDE THE LICENSE FILE.
test.describe.skip('Enterprise Feature Restrictions', () => {
  test.beforeAll(async () => {
    // Backup any existing license file before running tests
    await backupLicenseFile();
  });

  test.afterAll(async () => {
    // Restore the backup license file after all tests complete
    await restoreLicenseFile();
  });

  test.beforeEach(async () => {
    // Clean up license file before each test to ensure clean state
    await writeLicenseFile(null);
  });

  test.afterEach(async () => {
    // Clean up license file after each test
    await writeLicenseFile(null);
  });

  test('[ADMIN CLAIMS]: shows restricted features with asterisk when no license', async ({
    page,
  }) => {
    // Ensure no license file exists
    await writeLicenseFile(null);

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin/claims',
    });

    // Click Create claim button to open the dialog
    await page.getByRole('button', { name: 'Create claim' }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Check that enterprise features have asterisks (are restricted)
    // These are the enterprise features that should be marked with *
    await expect(page.getByText(/Email domains\s¹/)).toBeVisible();
    await expect(page.getByText(/Embed authoring\s¹/)).toBeVisible();
    await expect(page.getByText(/White label for embed authoring\s¹/)).toBeVisible();
    await expect(page.getByText(/21 CFR\s¹/)).toBeVisible();
    await expect(page.getByText(/Authentication portal\s¹/)).toBeVisible();

    // Check that the alert is visible
    await expect(
      page.getByText('Your current license does not include these features.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Learn more' })).toBeVisible();

    // Check that enterprise feature checkboxes are disabled
    const emailDomainsCheckbox = page.locator('#flag-emailDomains');
    await expect(emailDomainsCheckbox).toBeDisabled();

    const cfr21Checkbox = page.locator('#flag-cfr21');
    await expect(cfr21Checkbox).toBeDisabled();

    const authPortalCheckbox = page.locator('#flag-authenticationPortal');
    await expect(authPortalCheckbox).toBeDisabled();
  });

  test('[ADMIN CLAIMS]: no restrictions when license has all enterprise features', async ({
    page,
  }) => {
    // Create a license with ALL enterprise features enabled
    await writeLicenseFile(
      createMockLicenseWithFlags({
        emailDomains: true,
        embedAuthoring: true,
        embedAuthoringWhiteLabel: true,
        cfr21: true,
        authenticationPortal: true,
        billing: true,
      }),
    );

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin/claims',
    });

    // Click Create claim button to open the dialog
    await page.getByRole('button', { name: 'Create claim' }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Check that enterprise features do NOT have asterisks
    // They should show without the * since the license covers them
    await expect(page.getByText(/Email domains\s¹/)).not.toBeVisible();
    await expect(page.getByText(/Embed authoring\s¹/)).not.toBeVisible();
    await expect(page.getByText(/21 CFR\s¹/)).not.toBeVisible();
    await expect(page.getByText(/Authentication portal\s¹/)).not.toBeVisible();

    // The plain labels should be visible (without asterisks)
    await expect(page.locator('label[for="flag-emailDomains"]')).toContainText('Email domains');
    await expect(page.locator('label[for="flag-cfr21"]')).toContainText('21 CFR');

    // The alert should NOT be visible
    await expect(
      page.getByText('Your current license does not include these features.'),
    ).not.toBeVisible();

    // Check that enterprise feature checkboxes are enabled
    const emailDomainsCheckbox = page.locator('#flag-emailDomains');
    await expect(emailDomainsCheckbox).toBeEnabled();

    const cfr21Checkbox = page.locator('#flag-cfr21');
    await expect(cfr21Checkbox).toBeEnabled();

    const authPortalCheckbox = page.locator('#flag-authenticationPortal');
    await expect(authPortalCheckbox).toBeEnabled();
  });

  test('[ADMIN CLAIMS]: only unlicensed features show asterisk with partial license', async ({
    page,
  }) => {
    // Create a license with SOME enterprise features (emailDomains and cfr21)
    await writeLicenseFile(
      createMockLicenseWithFlags({
        emailDomains: true,
        cfr21: true,
        // embedAuthoring, embedAuthoringWhiteLabel, authenticationPortal are NOT included
      }),
    );

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin/claims',
    });

    // Click Create claim button to open the dialog
    await page.getByRole('button', { name: 'Create claim' }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Features NOT in license should have asterisks
    await expect(page.getByText(/Embed authoring\s¹/)).toBeVisible();
    await expect(page.getByText(/White label for embed authoring\s¹/)).toBeVisible();
    await expect(page.getByText(/Authentication portal\s¹/)).toBeVisible();

    // Features IN license should NOT have asterisks
    await expect(page.getByText(/Email domains\s¹/)).not.toBeVisible();
    await expect(page.getByText(/21 CFR\s¹/)).not.toBeVisible();

    // The plain labels for licensed features should be visible
    await expect(page.locator('label[for="flag-emailDomains"]')).toContainText('Email domains');
    await expect(page.locator('label[for="flag-cfr21"]')).toContainText('21 CFR');

    // Alert should be visible since some features are restricted
    await expect(
      page.getByText('Your current license does not include these features.'),
    ).toBeVisible();

    // Licensed features should be enabled
    const emailDomainsCheckbox = page.locator('#flag-emailDomains');
    await expect(emailDomainsCheckbox).toBeEnabled();

    const cfr21Checkbox = page.locator('#flag-cfr21');
    await expect(cfr21Checkbox).toBeEnabled();

    // Unlicensed features should be disabled
    const embedAuthoringCheckbox = page.locator('#flag-embedAuthoring');
    await expect(embedAuthoringCheckbox).toBeDisabled();

    const authPortalCheckbox = page.locator('#flag-authenticationPortal');
    await expect(authPortalCheckbox).toBeDisabled();
  });

  test('[ADMIN CLAIMS]: non-enterprise features are always enabled', async ({ page }) => {
    // Ensure no license file exists
    await writeLicenseFile(null);

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin/claims',
    });

    // Click Create claim button to open the dialog
    await page.getByRole('button', { name: 'Create claim' }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Non-enterprise features should NOT have asterisks
    await expect(page.getByText(/Unlimited documents\s¹/)).not.toBeVisible();
    await expect(page.getByText(/Branding\s¹/)).not.toBeVisible();
    await expect(page.getByText(/Embed signing\s¹/)).not.toBeVisible();

    // Non-enterprise features should always be enabled
    const unlimitedDocsCheckbox = page.locator('#flag-unlimitedDocuments');
    await expect(unlimitedDocsCheckbox).toBeEnabled();

    const brandingCheckbox = page.locator('#flag-allowCustomBranding');
    await expect(brandingCheckbox).toBeEnabled();

    const embedSigningCheckbox = page.locator('#flag-embedSigning');
    await expect(embedSigningCheckbox).toBeEnabled();
  });
});
