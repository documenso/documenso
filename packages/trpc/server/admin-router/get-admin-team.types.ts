import { z } from 'zod';

import OrganisationSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';
import TeamEmailSchema from '@documenso/prisma/generated/zod/modelSchema/TeamEmailSchema';
import TeamGlobalSettingsSchema from '@documenso/prisma/generated/zod/modelSchema/TeamGlobalSettingsSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';

export const ZGetAdminTeamRequestSchema = z.object({
  teamId: z.number().min(1),
});

export const ZGetAdminTeamResponseSchema = TeamSchema.extend({
  organisation: OrganisationSchema.pick({
    id: true,
    name: true,
    url: true,
  }),
  teamEmail: TeamEmailSchema.nullable(),
  teamGlobalSettings: TeamGlobalSettingsSchema,
  memberCount: z.number(),
});

export type TGetAdminTeamRequest = z.infer<typeof ZGetAdminTeamRequestSchema>;
export type TGetAdminTeamResponse = z.infer<typeof ZGetAdminTeamResponseSchema>;
