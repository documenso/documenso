import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { zfdBrandingImageFile, zodFormData } from '../../utils/zod-form-data';

export const ZUpdateOrganisationBrandingLogoRequestSchema = zodFormData({
  payload: zfd.json(
    z.object({
      organisationId: z.string(),
    }),
  ),
  brandingLogo: zfdBrandingImageFile().optional(),
});

export const ZUpdateOrganisationBrandingLogoResponseSchema = z.void();

export type TUpdateOrganisationBrandingLogoRequest = z.infer<typeof ZUpdateOrganisationBrandingLogoRequestSchema>;
