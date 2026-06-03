// ABOUTME: Zod schemas and inferred TypeScript types for the team merge feature.
// ABOUTME: Used by the merge-teams and preview-merge-teams TRPC routes.
import { z } from 'zod';

import { ZTeamNameSchema, ZTeamUrlSchema } from './schema';

export const ZMergeTeamsPreviewRequestSchema = z.object({
  organisationId: z.string(),
  sourceTeamIds: z.array(z.number()).min(1),
  destinationTeamId: z.number().optional(),
});

export type TMergeTeamsPreviewRequest = z.infer<typeof ZMergeTeamsPreviewRequestSchema>;

export const ZMergeTeamsPreviewResponseSchema = z.object({
  moving: z.object({
    documents: z.number(),
    templates: z.number(),
    folders: z.number(),
    members: z.number(),
  }),
  discarding: z.object({
    webhooks: z.number(),
    apiTokens: z.number(),
    teamEmails: z.number(),
    teamSettings: z.number(),
  }),
});

export type TMergeTeamsPreviewResponse = z.infer<typeof ZMergeTeamsPreviewResponseSchema>;

export const ZMergeTeamsRequestSchema = z
  .object({
    organisationId: z.string(),
    sourceTeamIds: z.array(z.number()).min(1),
    destinationTeamId: z.number().optional(),
    newTeamName: ZTeamNameSchema.optional(),
    newTeamUrl: ZTeamUrlSchema.optional(),
  })
  .refine(
    (data) =>
      data.destinationTeamId !== undefined ||
      (data.newTeamName !== undefined && data.newTeamUrl !== undefined),
    {
      message: 'Either destinationTeamId or both newTeamName and newTeamUrl must be provided.',
    },
  );

export type TMergeTeamsRequest = z.infer<typeof ZMergeTeamsRequestSchema>;

export const ZMergeTeamsResponseSchema = ZMergeTeamsPreviewResponseSchema;

export type TMergeTeamsResponse = z.infer<typeof ZMergeTeamsResponseSchema>;
