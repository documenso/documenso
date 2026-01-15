import { z } from 'zod';

export const ZResyncLicenseRequestSchema = z.void();

export const ZResyncLicenseResponseSchema = z.void();

export type TResyncLicenseRequest = z.infer<typeof ZResyncLicenseRequestSchema>;
export type TResyncLicenseResponse = z.infer<typeof ZResyncLicenseResponseSchema>;
