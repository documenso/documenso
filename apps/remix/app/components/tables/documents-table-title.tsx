import type { Document, Recipient, Team, User } from '@prisma/client';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';

export type DataTableTitleProps = {
  row: Document & {
    user: Pick<User, 'id' | 'name' | 'email'>;
    team: Pick<Team, 'url'> | null;
    recipients: Recipient[];
  };
  teamUrl?: string;
};

export const DataTableTitle = ({ row, teamUrl }: DataTableTitleProps) => {
  const { user } = useSession();

  const recipient = row.recipients.find((recipient) => recipient.email === user.email);

  const isOwner = row.user.id === user.id;
  const isRecipient = !!recipient;
  const isCurrentTeamDocument = teamUrl && row.team?.url === teamUrl;

  const documentsPath = formatDocumentsPath(isCurrentTeamDocument ? teamUrl : undefined);

  return match({
    isOwner,
    isRecipient,
    isCurrentTeamDocument,
  })
    .with({ isOwner: true }, { isCurrentTeamDocument: true }, () => (
      <Link
        to={`${documentsPath}/${row.id}`}
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
