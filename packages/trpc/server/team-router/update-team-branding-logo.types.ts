import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { zfdBrandingImageFile, zodFormData } from '../../utils/zod-form-data';

export const ZUpdateTeamBrandingLogoRequestSchema = zodFormData({
  payload: zfd.json(
    z.object({
      teamId: z.number(),
    }),
  ),
  brandingLogo: zfdBrandingImageFile().optional(),
});

export const ZUpdateTeamBrandingLogoResponseSchema = z.void();

export type TUpdateTeamBrandingLogoRequest = z.infer<typeof ZUpdateTeamBrandingLogoRequestSchema>;
