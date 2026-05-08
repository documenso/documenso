import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const ZProvisionTeamMemberRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['MEMBER', 'MANAGER', 'ADMIN']).default('MEMBER'),
  password: z.string().min(8).optional(),
});

export type TProvisionTeamMemberRequest = z.infer<typeof ZProvisionTeamMemberRequestSchema>;

export const ZProvisionTeamMemberResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullable(),
  apiToken: z.string(),
});

export type TProvisionTeamMemberResponse = z.infer<typeof ZProvisionTeamMemberResponseSchema>;

export const provisionTeamMemberMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/team/members',
    summary: 'Provision team member',
    description:
      'Find or create a user by email, add them to the team, and return an API token. Idempotent for user/org/team membership.',
    tags: ['Team'],
  },
};
