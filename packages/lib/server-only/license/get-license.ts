import fs from 'node:fs/promises';
import path from 'node:path';

import { LICENSE_FILE_NAME, type TCachedLicense, ZCachedLicenseSchema } from '../../types/license';

/**
 * Get the cached license from the local file.
 *
 * Returns null if no license file exists or if the file is invalid.
 */
export const getLicense = async (): Promise<TCachedLicense | null> => {
  const licenseFilePath = path.join(process.cwd(), LICENSE_FILE_NAME);

  try {
    const fileContents = await fs.readFile(licenseFilePath, 'utf-8');
    const parsed = JSON.parse(fileContents);

    return ZCachedLicenseSchema.parse(parsed);
  } catch {
    // File doesn't exist or is invalid
    return null;
  }
};
