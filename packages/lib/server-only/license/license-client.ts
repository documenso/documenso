import type { TCachedLicense } from '../../types/license';

declare global {
  // eslint-disable-next-line no-var
  var __documenso_license_client__: LicenseClient | undefined;
}

export class LicenseClient {
  private constructor() {}

  public static async start(): Promise<void> {
    if (!globalThis.__documenso_license_client__) {
      globalThis.__documenso_license_client__ = new LicenseClient();
    }

    await Promise.resolve();
  }

  public static getInstance(): LicenseClient | null {
    return globalThis.__documenso_license_client__ ?? null;
  }

  public async getCachedLicense(): Promise<TCachedLicense | null> {
    const cachedLicense: TCachedLicense = {
      lastChecked: new Date().toISOString(),
      license: null,
      requestedLicenseKey: undefined,
      unauthorizedFlagUsage: false,
      derivedStatus: 'ACTIVE',
    };

    await Promise.resolve();

    return cachedLicense;
  }

  public async resync(): Promise<void> {}
}
