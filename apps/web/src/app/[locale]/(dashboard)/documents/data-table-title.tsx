'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

import { Document, Recipient, User } from '@documenso/prisma/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';

export type DataTableTitleProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
  };
};

export const DataTableTitle = ({ row }: DataTableTitleProps) => {
  const { data: session } = useSession();
  const locale = useParams()?.locale as LocaleTypes;

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
      <Link
        href={`/${locale}/documents/${row.id}`}
        title={row.title}
        className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
      >
        {row.title}
      </Link>
    ))
    .with({ isRecipient: true }, () => (
      <Link
        href={`/${locale}/sign/${recipient?.token}`}
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
