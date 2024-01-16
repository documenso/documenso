'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Copy, Edit, MoreHorizontal, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

import type { Template } from '@documenso/prisma/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { DeleteTemplateDialog } from './delete-template-dialog';
import { DuplicateTemplateDialog } from './duplicate-template-dialog';

export type DataTableActionDropdownProps = {
  row: Template;
};

export const DataTableActionDropdown = ({ row }: DataTableActionDropdownProps) => {
  const { data: session } = useSession();

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  if (!session) {
    return null;
  }

  const isOwner = row.userId === session.user.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <MoreHorizontal className="text-muted-foreground h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="start" forceMount>
        <DropdownMenuLabel>Action</DropdownMenuLabel>

        <DropdownMenuItem disabled={!isOwner} asChild>
          <Link href={`/templates/${row.id}`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>

        {/* <DropdownMenuItem disabled={!isOwner} onClick={async () => onDuplicateButtonClick(row.id)}> */}
        <DropdownMenuItem disabled={!isOwner} onClick={() => setDuplicateDialogOpen(true)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!isOwner} onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>

      <DuplicateTemplateDialog
        id={row.id}
        open={isDuplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />

      <DeleteTemplateDialog
        id={row.id}
        open={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </DropdownMenu>
  );
};
