'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Copy, Edit, MoreHorizontal, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { Template } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { toast } from '@documenso/ui/primitives/use-toast';

import { DeleteTemplateDialog } from './delete-template-dialog';

export type DataTableActionDropdownProps = {
  row: Template;
};

export const DataTableActionDropdown = ({ row }: DataTableActionDropdownProps) => {
  const { data: session } = useSession();

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const router = useRouter();

  if (!session) {
    return null;
  }

  const { mutateAsync: duplicateTemplate } = trpc.template.duplicateTemplate.useMutation();

  const onDuplicateButtonClick = async (templateId: number) => {
    try {
      await duplicateTemplate({
        templateId,
      });

      toast({
        title: 'Template duplicated',
        description: 'Your template has been duplicated successfully.',
        duration: 5000,
      });

      router.refresh();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while duplicating template.',
        variant: 'destructive',
      });
    }
  };

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

        <DropdownMenuItem disabled={!isOwner} onClick={async () => onDuplicateButtonClick(row.id)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!isOwner} onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>

      <DeleteTemplateDialog
        id={row.id}
        open={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </DropdownMenu>
  );
};
