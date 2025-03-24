import { DocumentVisibility } from '@prisma/client';
import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID = 'send.team-deleted.email';

const SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  team: z.object({
    name: z.string(),
    url: z.string(),
    ownerUserId: z.number(),
    teamGlobalSettings: z
      .object({
        documentVisibility: z.nativeEnum(DocumentVisibility),
        documentLanguage: z.string(),
        includeSenderDetails: z.boolean(),
        includeSigningCertificate: z.boolean(),
        brandingEnabled: z.boolean(),
        brandingLogo: z.string(),
        brandingUrl: z.string(),
        brandingCompanyDetails: z.string(),
        brandingHidePoweredBy: z.boolean(),
        teamId: z.number(),
        typedSignatureEnabled: z.boolean(),
        uploadSignatureEnabled: z.boolean(),
        drawSignatureEnabled: z.boolean(),
      })
      .nullish(),
  }),
  members: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    }),
  ),
});

export type TSendTeamDeletedEmailJobDefinition = z.infer<
  typeof SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION = {
  id: SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Team Deleted Email',
  version: '1.0.0',
  trigger: {
    name: SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-team-deleted-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID,
  TSendTeamDeletedEmailJobDefinition
>;
