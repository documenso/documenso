import { sendTeamDeleteEmail } from '../../../server-only/team/delete-team';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendTeamDeletedEmailJobDefinition } from './send-team-deleted-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendTeamDeletedEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { team, members, organisationId } = payload;

  for (const member of members) {
    await io.runTask(`send-team-deleted-email--${team.url}_${member.id}`, async () => {
      await sendTeamDeleteEmail({
        email: member.email,
        team,
        organisationId,
      });
    });
  }
};
