import { z } from 'zod';

import { updateTeamBrandingSettings } from '@documenso/lib/server-only/team/update-team-branding-settings';

import { authenticatedProcedure } from '../trpc';

export const ZUpdateTeamBrandingSettingsRequestSchema = z.object({
  teamId: z.number(),
  settings: z.object({
    brandingEnabled: z.boolean().optional().default(false),
    brandingLogo: z.string().optional().default(''),
    brandingUrl: z.string().optional().default(''),
    brandingCompanyDetails: z.string().optional().default(''),
  }),
});

export const updateTeamBrandingSettingsRoute = authenticatedProcedure
  .input(ZUpdateTeamBrandingSettingsRequestSchema)
  .mutation(async ({ ctx, input }) => {
    const { teamId, settings } = input;

    return await updateTeamBrandingSettings({
      userId: ctx.user.id,
      teamId,
      settings,
    });
  });
