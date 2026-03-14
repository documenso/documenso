import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { TCachedLicense } from '@documenso/lib/types/license';
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
 * Create a mock license object with the given status and unauthorized flag.
 */
const createMockLicense = (
  status: 'ACTIVE' | 'EXPIRED' | 'PAST_DUE',
  unauthorizedFlagUsage: boolean,
): TCachedLicense => {
  return {
    lastChecked: new Date().toISOString(),
    license: {
      status,
      createdAt: new Date(),
      name: 'Test License',
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      cancelAtPeriodEnd: false,
      licenseKey: 'test-license-key',
      flags: {},
    },
    requestedLicenseKey: 'test-license-key',
    derivedStatus: unauthorizedFlagUsage ? 'UNAUTHORIZED' : status,
    unauthorizedFlagUsage,
  };
};

/**
 * Create a mock license object with no license data (only unauthorized flag).
 */
const createMockUnauthorizedWithoutLicense = (): TCachedLicense => {
  return {
    lastChecked: new Date().toISOString(),
    license: null,
    unauthorizedFlagUsage: true,
    derivedStatus: 'UNAUTHORIZED',
  };
};

// Run tests serially to avoid race conditions with the license file
test.describe.configure({ mode: 'serial' });

// SKIPPING TEST UNTIL WE ADD A WAY TO OVERRIDE THE LICENSE FILE.
test.describe.skip('License Status Banner', () => {
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

  test('[ADMIN]: no banner when license file is missing', async ({ page }) => {
    // Ensure no license file exists BEFORE any page loads
    await writeLicenseFile(null);

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    // Navigate to admin page - license is read during page load
    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin',
    });

    // Verify we're on the admin page
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();

    // Global banner should not be visible (no license file)
    await expect(
      page.getByText('This is an expired license instance of Documenso'),
    ).not.toBeVisible();

    // Admin banner messages should not be visible (no license file means no banner)
    await expect(page.getByText('License payment overdue')).not.toBeVisible();
    await expect(page.getByText('License expired')).not.toBeVisible();
    await expect(page.getByText('Invalid License Type')).not.toBeVisible();
    await expect(page.getByText('Missing License')).not.toBeVisible();
  });

  test('[ADMIN]: no banner when license is ACTIVE', async ({ page }) => {
    // Create an ACTIVE license BEFORE any page loads
    await writeLicenseFile(createMockLicense('ACTIVE', false));

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    // Navigate to admin page - license is read during page load
    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin',
    });

    // Verify we're on the admin page
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();

    // Global banner should not be visible (license is ACTIVE)
    await expect(
      page.getByText('This is an expired license instance of Documenso'),
    ).not.toBeVisible();

    // Admin banner messages should not be visible (license is ACTIVE)
    await expect(page.getByText('License payment overdue')).not.toBeVisible();
    await expect(page.getByText('License expired')).not.toBeVisible();
    await expect(page.getByText('Invalid License Type')).not.toBeVisible();
  });

  test('[ADMIN]: admin banner shows PAST_DUE warning', async ({ page }) => {
    // Create a PAST_DUE license BEFORE any page loads
    await writeLicenseFile(createMockLicense('PAST_DUE', false));

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    // Navigate to admin page - license is read during page load
    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin',
    });

    // Verify we're on the admin page
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();

    // Global banner should NOT be visible (only shows for EXPIRED + unauthorized)
    await expect(
      page.getByText('This is an expired license instance of Documenso'),
    ).not.toBeVisible();

    // Admin banner should show PAST_DUE message
    await expect(page.getByText('License payment overdue')).toBeVisible();
    await expect(
      page.getByText('Please update your payment to avoid service disruptions.'),
    ).toBeVisible();

    // Should have the "See Documentation" link
    await expect(page.getByRole('link', { name: 'See Documentation' })).toBeVisible();
  });

  test('[ADMIN]: admin banner shows EXPIRED error', async ({ page }) => {
    // Create an EXPIRED license WITHOUT unauthorized usage BEFORE any page loads
    await writeLicenseFile(createMockLicense('EXPIRED', false));

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    // Navigate to admin page - license is read during page load
    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin',
    });

    // Verify we're on the admin page
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();

    // Global banner should NOT be visible (requires BOTH expired AND unauthorized)
    await expect(
      page.getByText('This is an expired license instance of Documenso'),
    ).not.toBeVisible();

    // Admin banner should show EXPIRED message
    await expect(page.getByText('License expired')).toBeVisible();
    await expect(
      page.getByText('Please renew your license to continue using enterprise features.'),
    ).toBeVisible();

    // Should have the "See Documentation" link
    await expect(page.getByRole('link', { name: 'See Documentation' })).toBeVisible();
  });

  test.skip('[ADMIN]: global banner shows when EXPIRED with unauthorized usage', async ({
    page,
  }) => {
    // Create an EXPIRED license WITH unauthorized usage BEFORE any page loads
    await writeLicenseFile(createMockLicense('EXPIRED', true));

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    // Navigate to admin page - license is read during page load
    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin',
    });

    // Verify we're on the admin page
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();

    // Global banner SHOULD be visible (EXPIRED + unauthorized)
    await expect(page.getByText('This is an expired license instance of Documenso')).toBeVisible();

    // Admin banner should show UNAUTHORIZED message (takes precedence over EXPIRED)
    await expect(page.getByText('Invalid License Type')).toBeVisible();
    await expect(
      page.getByText(
        'Your Documenso instance is using features that are not part of your license.',
      ),
    ).toBeVisible();
  });

  test('[ADMIN]: admin banner shows UNAUTHORIZED when flags are misused with license', async ({
    page,
  }) => {
    // Create an ACTIVE license but WITH unauthorized flag usage BEFORE any page loads
    await writeLicenseFile(createMockLicense('ACTIVE', true));

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    // Navigate to admin page - license is read during page load
    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin',
    });

    // Verify we're on the admin page
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();

    // Global banner should NOT be visible (requires EXPIRED status)
    await expect(
      page.getByText('This is an expired license instance of Documenso'),
    ).not.toBeVisible();

    // Admin banner should show UNAUTHORIZED message
    await expect(page.getByText('Invalid License Type')).toBeVisible();
    await expect(
      page.getByText(
        'Your Documenso instance is using features that are not part of your license.',
      ),
    ).toBeVisible();

    // Should have the "See Documentation" link
    await expect(page.getByRole('link', { name: 'See Documentation' })).toBeVisible();
  });

  test('[ADMIN]: admin banner shows Invalid License Type when unauthorized without license data', async ({
    page,
  }) => {
    // Create a license file with unauthorized flag but no license data BEFORE any page loads
    // Note: Even without license data, the banner shows "Invalid License Type" because the
    // license file exists (just with license: null). The "Missing License" message would only
    // show if the entire license prop was null, which doesn't happen with a valid file.
    await writeLicenseFile(createMockUnauthorizedWithoutLicense());

    const { user: adminUser } = await seedUser({
      isAdmin: true,
    });

    // Navigate to admin page - license is read during page load
    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: '/admin',
    });

    // Verify we're on the admin page
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();

    // Global banner should NOT be visible (no EXPIRED status, only unauthorized flag)
    await expect(
      page.getByText('This is an expired license instance of Documenso'),
    ).not.toBeVisible();

    // Admin banner should show Invalid License Type message (unauthorized flag is set)
    await expect(page.getByText('Invalid License Type')).toBeVisible();
    await expect(
      page.getByText(
        'Your Documenso instance is using features that are not part of your license.',
      ),
    ).toBeVisible();

    // Should have the "See Documentation" link
    await expect(page.getByRole('link', { name: 'See Documentation' })).toBeVisible();
  });

  test.skip('[ADMIN]: global banner visible on non-admin pages when EXPIRED with unauthorized', async ({
    page,
  }) => {
    // Create an EXPIRED license WITH unauthorized usage BEFORE any page loads
    await writeLicenseFile(createMockLicense('EXPIRED', true));

    const { user } = await seedUser();

    // Navigate to documents page - license is read during page load
    await apiSignin({
      page,
      email: user.email,
      redirectPath: '/documents',
    });

    // Global banner SHOULD be visible on any authenticated page (EXPIRED + unauthorized)
    await expect(page.getByText('This is an expired license instance of Documenso')).toBeVisible();
  });
});
