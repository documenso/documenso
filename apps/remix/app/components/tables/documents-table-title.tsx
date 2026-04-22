import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { useSession } from '@documenso/lib/client-only/providers/session';
import type { TDocumentMany as TDocumentRow } from '@documenso/lib/types/document';
import { findRecipientByEmail } from '@documenso/lib/utils/recipients';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';

import { useCurrentTeam } from '~/providers/team';

export type DataTableTitleProps = {
  row: TDocumentRow;
  teamUrl: string;
};

export const DataTableTitle = ({ row, teamUrl }: DataTableTitleProps) => {
  const { user } = useSession();
  const team = useCurrentTeam();

  const recipient = findRecipientByEmail({
    recipients: row.recipients,
    userEmail: user.email,
    teamEmail: team.teamEmail?.email,
  });

  const isOwner = row.user.id === user.id;
  const isRecipient = !!recipient;
  const isCurrentTeamDocument = teamUrl && row.team?.url === teamUrl;

  const documentsPath = formatDocumentsPath(teamUrl);

  return match({
    isOwner,
    isRecipient,
    isCurrentTeamDocument,
  })
    .with({ isOwner: true }, { isCurrentTeamDocument: true }, () => (
      <Link
        to={`${documentsPath}/${row.envelopeId}`}
        title={row.title}
        className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
      >
        {row.title}
      </Link>
    ))
    .with({ isRecipient: true }, () => (
      <Link
        to={`/sign/${recipient?.token}`}
        title={row.title}
        className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
      >
        {row.title}
      </Link>
    ))
    .otherwise(() => (
      <span className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]">
        {row.title}
      </span>
    ));
};
