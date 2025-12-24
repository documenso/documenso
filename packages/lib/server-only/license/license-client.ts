import fs from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../constants/app';
import type { TLicenseClaim } from '../../types/license';
import {
  LICENSE_FILE_NAME,
  type TCachedLicense,
  type TLicenseResponse,
  ZLicenseResponseSchema,
} from '../../types/license';
import { SUBSCRIPTION_CLAIM_FEATURE_FLAGS } from '../../types/subscription';
import { env } from '../../utils/env';

const LICENSE_KEY = env('NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY');
const LICENSE_SERVER_URL =
  env('INTERNAL_OVERRIDE_LICENSE_SERVER_URL') || 'https://license.documenso.com';

export class LicenseClient {
  private static instance: LicenseClient | null = null;

  private licenseResponse: TLicenseResponse | null = null;

  private constructor() {}

  /**
   * Start the license client.
   *
   * This will ping the license server with the configured license key and store
   * the response locally in a JSON file.
   */
  public static async start(): Promise<void> {
    if (LicenseClient.instance) {
      return;
    }

    const instance = new LicenseClient();

    LicenseClient.instance = instance;

    try {
      await instance.initialize();
    } catch (err) {
      // Do nothing.
      console.error('[License] Failed to verify license:', err);
    }
  }

  /**
   * Get the current license client instance.
   */
  public static getInstance(): LicenseClient | null {
    return LicenseClient.instance;
  }

  /**
   * Get the cached license response.
   */
  public getLicenseResponse(): TLicenseResponse | null {
    return this.licenseResponse;
  }

  private async initialize(): Promise<void> {
    console.log('[License] Checking license with server...');

    const response = await this.pingLicenseServer();

    this.licenseResponse = response;

    const allowedFlags = response?.data?.flags || {};

    // Check for unauthorized flag usage
    const unauthorizedFlagUsage = await this.checkUnauthorizedFlagUsage(allowedFlags);

    if (unauthorizedFlagUsage) {
      console.warn('[License] Found unauthorized flag usage.');
    }

    const data: TCachedLicense = {
      lastChecked: new Date().toISOString(),
      license: response?.data || null,
      requestedLicenseKey: LICENSE_KEY,
      unauthorizedFlagUsage,
    };

    await this.saveToFile(data);

    console.log('[License] License check completed successfully.');
  }

  /**
   * Ping the license server to get the license response.
   *
   * If license not found returns null.
   */
  private async pingLicenseServer(): Promise<TLicenseResponse | null> {
    if (!LICENSE_KEY || !LICENSE_SERVER_URL) {
      return null;
    }

    const endpoint = new URL('api/license', LICENSE_SERVER_URL).toString();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ license: LICENSE_KEY }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }

      throw new Error(`License server returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return ZLicenseResponseSchema.parse(data);
  }

  private async saveToFile(data: TCachedLicense): Promise<void> {
    const licenseFilePath = path.join(process.cwd(), LICENSE_FILE_NAME);

    try {
      await fs.writeFile(licenseFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[License] Failed to save license file:', error);
    }
  }

  /**
   * Check if any organisation claims are using flags that are not permitted by the current license.
   */
  private async checkUnauthorizedFlagUsage(licenseFlags: Partial<TLicenseClaim>): Promise<boolean> {
    // Get flags that are NOT permitted by the license by subtracting the allowed flags from the license flags.
    const disallowedFlags = Object.values(SUBSCRIPTION_CLAIM_FEATURE_FLAGS).filter(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (flag) => flag.isEnterprise && !licenseFlags[flag.key as keyof TLicenseClaim],
    );

    let unauthorizedFlagUsage = false;

    if (IS_BILLING_ENABLED() && !licenseFlags.billing) {
      unauthorizedFlagUsage = true;
    }

    try {
      const organisationWithUnauthorizedFlags = await prisma.organisationClaim.findFirst({
        where: {
          OR: disallowedFlags.map((flag) => ({
            flags: {
              path: [flag.key],
              equals: true,
            },
          })),
        },
      });

      if (organisationWithUnauthorizedFlags) {
        unauthorizedFlagUsage = true;
      }
    } catch (error) {
      console.error('[License] Failed to check unauthorized flag usage:', error);
    }

    return unauthorizedFlagUsage;
  }
}
