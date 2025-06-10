import { z } from 'zod';

import { ZTeamNameSchema, ZTeamUrlSchema } from './schema';

export const MAX_PROFILE_BIO_LENGTH = 256;

// If we enable this, consider whether we should move the profile updates to
// a separate endpoint since that's a separate action.
// export const updateTeamMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/team/{teamId}',
//     summary: 'Update team',
//     description: 'Update an team',
//     tags: ['team'],
//   },
// };

export const ZUpdateTeamRequestSchema = z.object({
  teamId: z.number(),
  data: z.object({
    name: ZTeamNameSchema.optional(),
    url: ZTeamUrlSchema.optional(),
    profileBio: z
      .string()
      .max(MAX_PROFILE_BIO_LENGTH, {
        message: `Bio must be shorter than ${MAX_PROFILE_BIO_LENGTH + 1} characters`,
      })
      .optional(),
    profileEnabled: z.boolean().optional(),
  }),
});

export const ZUpdateTeamResponseSchema = z.void();
