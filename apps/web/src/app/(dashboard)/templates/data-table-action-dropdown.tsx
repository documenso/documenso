'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Copy, Edit, MoreHorizontal, MoveRight, Share2Icon, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { type FindTemplateRow } from '@documenso/lib/server-only/template/find-templates';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { DeleteTemplateDialog } from './delete-template-dialog';
import { DuplicateTemplateDialog } from './duplicate-template-dialog';
import { MoveTemplateDialog } from './move-template-dialog';
import { TemplateDirectLinkDialog } from './template-direct-link-dialog';

export type DataTableActionDropdownProps = {
  row: FindTemplateRow;
  templateRootPath: string;
  teamId?: number;
};

export const DataTableActionDropdown = ({
  row,
  templateRootPath,
  teamId,
}: DataTableActionDropdownProps) => {
  const { data: session } = useSession();

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isTemplateDirectLinkDialogOpen, setTemplateDirectLinkDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [isMoveDialogOpen, setMoveDialogOpen] = useState(false);

  if (!session) {
    return null;
  }

  const isOwner = row.userId === session.user.id;
  const isTeamTemplate = row.teamId === teamId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <MoreHorizontal className="text-muted-foreground h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="start" forceMount>
        <DropdownMenuLabel>Action</DropdownMenuLabel>

        <DropdownMenuItem disabled={!isOwner && !isTeamTemplate} asChild>
          <Link href={`${templateRootPath}/${row.id}`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={!isOwner && !isTeamTemplate}
          onClick={() => setDuplicateDialogOpen(true)}
        >
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setTemplateDirectLinkDialogOpen(true)}>
          <Share2Icon className="mr-2 h-4 w-4" />
          Direct link
        </DropdownMenuItem>

        {!teamId && (
          <DropdownMenuItem onClick={() => setMoveDialogOpen(true)}>
            <MoveRight className="mr-2 h-4 w-4" />
            Move to Team
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          disabled={!isOwner && !isTeamTemplate}
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>

      <DuplicateTemplateDialog
        id={row.id}
        teamId={teamId}
        open={isDuplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />

      <TemplateDirectLinkDialog
        template={row}
        open={isTemplateDirectLinkDialogOpen}
        onOpenChange={setTemplateDirectLinkDialogOpen}
      />

      <MoveTemplateDialog
        templateId={row.id}
        open={isMoveDialogOpen}
        onOpenChange={setMoveDialogOpen}
      />

      <DeleteTemplateDialog
        id={row.id}
        teamId={row.teamId || undefined}
        open={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </DropdownMenu>
  );
};
