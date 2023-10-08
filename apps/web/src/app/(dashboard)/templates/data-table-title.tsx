'use client';

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
    <span className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]">
      {row.title}
    </span>
  );
};
