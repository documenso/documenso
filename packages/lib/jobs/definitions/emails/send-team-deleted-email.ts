import { z } from 'zod';

import { DocumentVisibility } from '@documenso/prisma/client';

import { sendTeamDeleteEmail } from '../../../server-only/team/delete-team';
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

export const SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION = {
  id: SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Team Deleted Email',
  version: '1.0.0',
  trigger: {
    name: SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const { team, members } = payload;

    for (const member of members) {
      await io.runTask(`send-team-deleted-email--${team.url}_${member.id}`, async () => {
        await sendTeamDeleteEmail({
          email: member.email,
          team,
          isOwner: member.id === team.ownerUserId,
        });
      });
    }
  },
} as const satisfies JobDefinition<
  typeof SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID,
  z.infer<typeof SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_SCHEMA>
>;
