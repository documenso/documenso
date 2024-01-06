import Link from 'next/link';

import { useSession } from 'next-auth/react';

import { Template } from '@documenso/prisma/client';

export type DataTableTitleProps = {
  row: Template;
};

export const DataTableTitle = ({ row }: DataTableTitleProps) => {
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  return (
    <Link
      href={`/templates/${row.id}`}
      className="block max-w-[10rem] cursor-pointer truncate font-medium hover:underline md:max-w-[20rem]"
    >
      {row.title}
    </Link>
  );
};
