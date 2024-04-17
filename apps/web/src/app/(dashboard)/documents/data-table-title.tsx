'use client';

import Link from 'next/link';

import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

<<<<<<< HEAD
import { Document, Recipient, User } from '@documenso/prisma/client';
=======
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Document, Recipient, Team, User } from '@documenso/prisma/client';
>>>>>>> main

export type DataTableTitleProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
<<<<<<< HEAD
    Recipient: Recipient[];
  };
};

export const DataTableTitle = ({ row }: DataTableTitleProps) => {
=======
    team: Pick<Team, 'url'> | null;
    Recipient: Recipient[];
  };
  teamUrl?: string;
};

export const DataTableTitle = ({ row, teamUrl }: DataTableTitleProps) => {
>>>>>>> main
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  const recipient = row.Recipient.find((recipient) => recipient.email === session.user.email);

  const isOwner = row.User.id === session.user.id;
  const isRecipient = !!recipient;
<<<<<<< HEAD
=======
  const isCurrentTeamDocument = teamUrl && row.team?.url === teamUrl;

  const documentsPath = formatDocumentsPath(isCurrentTeamDocument ? teamUrl : undefined);
>>>>>>> main

  return match({
    isOwner,
    isRecipient,
<<<<<<< HEAD
  })
    .with({ isOwner: true }, () => (
      <Link
        href={`/documents/${row.id}`}
=======
    isCurrentTeamDocument,
  })
    .with({ isOwner: true }, { isCurrentTeamDocument: true }, () => (
      <Link
        href={`${documentsPath}/${row.id}`}
>>>>>>> main
        title={row.title}
        className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
      >
        {row.title}
      </Link>
    ))
    .with({ isRecipient: true }, () => (
      <Link
        href={`/sign/${recipient?.token}`}
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
