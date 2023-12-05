'use client';

import Link from 'next/link';

import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

import type { Document, DocumentThumbnail, Recipient, User } from '@documenso/prisma/client';

import { DataTableImage } from './data-table-image';

export type DataTableTitleProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
    documentThumbnail: DocumentThumbnail;
  };
};

export const DataTableTitle = ({ row }: DataTableTitleProps) => {
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  const recipient = row.Recipient.find((recipient) => recipient.email === session.user.email);

  const isOwner = row.User.id === session.user.id;
  const isRecipient = !!recipient;

  return match({
    isOwner,
    isRecipient,
  })
    .with({ isOwner: true }, () => (
      <div className="flex flex-row items-center">
        <DataTableImage row={row} />
        <Link
          href={`/documents/${row.id}`}
          title={row.title}
          className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
        >
          {row.title}
        </Link>
      </div>
    ))
    .with({ isRecipient: true }, () => (
      <div className="flex flex-row items-center">
        <DataTableImage row={row} />
        <Link
          href={`/sign/${recipient?.token}`}
          title={row.title}
          className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
        >
          {row.title}
        </Link>
      </div>
    ))
    .otherwise(() => (
      <span className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]">
        <DataTableImage row={row} />
        {row.title}
      </span>
    ));
};
