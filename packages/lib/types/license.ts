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
  data: z.object({
    status: z.enum(['ACTIVE', 'EXPIRED', 'PAST_DUE']),
    createdAt: z.coerce.date(),
    name: z.string(),
    periodEnd: z.coerce.date(),
    cancelAtPeriodEnd: z.boolean(),
    licenseKey: z.string(),
    flags: ZLicenseClaimSchema,
  }),
});

export type TLicenseClaim = z.infer<typeof ZLicenseClaimSchema>;
export type TLicenseRequest = z.infer<typeof ZLicenseRequestSchema>;
export type TLicenseResponse = z.infer<typeof ZLicenseResponseSchema>;

/**
 * Schema for the cached license data stored in the file.
 */
export const ZCachedLicenseSchema = z.object({
  lastChecked: z.string(),
  license: ZLicenseResponseSchema.shape.data.nullable(),
  requestedLicenseKey: z.string().optional(),
  unauthorizedFlagUsage: z.boolean(),
});

export type TCachedLicense = z.infer<typeof ZCachedLicenseSchema>;

export const LICENSE_FILE_NAME = '.documenso-license.json';
