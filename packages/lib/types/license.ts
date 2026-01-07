import { z } from 'zod';

/**
 * Note: Keep this in sync with the Documenso License Server schemas.
 */
export const ZLicenseClaimSchema = z.object({
  emailDomains: z.boolean().optional(),
  embedAuthoring: z.boolean().optional(),
  embedAuthoringWhiteLabel: z.boolean().optional(),
  cfr21: z.boolean().optional(),
  authenticationPortal: z.boolean().optional(),
  billing: z.boolean().optional(),
});

/**
 * Note: Keep this in sync with the Documenso License Server schemas.
 */
export const ZLicenseRequestSchema = z.object({
  license: z.string().min(1, 'License key is required'),
});

/**
 * Note: Keep this in sync with the Documenso License Server schemas.
 */
export const ZLicenseResponseSchema = z.object({
  success: z.boolean(),
  // Note that this is nullable, null means license was not found.
  data: z
    .object({
      status: z.enum(['ACTIVE', 'EXPIRED', 'PAST_DUE']),
      createdAt: z.coerce.date(),
      name: z.string(),
      periodEnd: z.coerce.date(),
      cancelAtPeriodEnd: z.boolean(),
      licenseKey: z.string(),
      flags: ZLicenseClaimSchema,
    })
    .nullable(),
});

export type TLicenseClaim = z.infer<typeof ZLicenseClaimSchema>;
export type TLicenseRequest = z.infer<typeof ZLicenseRequestSchema>;
export type TLicenseResponse = z.infer<typeof ZLicenseResponseSchema>;

/**
 * Schema for the cached license data stored in the file.
 */
export const ZCachedLicenseSchema = z.object({
  /**
   * The last time the license was synced.
   */
  lastChecked: z.string(),

  /**
   * The raw license response from the license server.
   */
  license: ZLicenseResponseSchema.shape.data,

  /**
   * The license key that is currently stored on the system environment variable.
   */
  requestedLicenseKey: z.string().optional(),

  /**
   * Whether the current license has unauthorized flag usage.
   */
  unauthorizedFlagUsage: z.boolean(),

  /**
   * The derived status of the license. This is calculated based on the license response and the unauthorized flag usage.
   */
  derivedStatus: z.enum([
    'UNAUTHORIZED', // Unauthorized flag usage detected, overrides everything except PAST_DUE since that's a grace period.
    'ACTIVE', // License is active and everything is good.
    'EXPIRED', // License is expired and there is no unauthorized flag usage.
    'PAST_DUE', // License is past due.
    'NOT_FOUND', // Requested license key is not found.
  ]),
});

export type TCachedLicense = z.infer<typeof ZCachedLicenseSchema>;

export const LICENSE_FILE_NAME = '.documenso-license.json';
