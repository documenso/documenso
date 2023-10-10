'use client';

import Link from 'next/link';

import { Edit } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { Document } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';

export type DataTableActionButtonProps = {
  row: Pick<Document, 'id'>;
};

export const DataTableActionButton = ({ row }: DataTableActionButtonProps) => {
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  return (
    <Button className="w-24" asChild>
      <Link href={`/documents/${row.id}`}>
        <Edit className="-ml-1 mr-2 h-4 w-4" />
        Edit
      </Link>
    </Button>
  );
};
