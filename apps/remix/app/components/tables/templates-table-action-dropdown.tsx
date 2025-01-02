import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { Recipient, Template, TemplateDirectLink } from '@prisma/client';
import { Copy, Edit, MoreHorizontal, MoveRight, Share2Icon, Trash2, Upload } from 'lucide-react';
import { Link } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { TemplateBulkSendDialog } from '../dialogs/template-bulk-send-dialog';
import { TemplateDeleteDialog } from '../dialogs/template-delete-dialog';
import { TemplateDirectLinkDialog } from '../dialogs/template-direct-link-dialog';
import { TemplateDuplicateDialog } from '../dialogs/template-duplicate-dialog';
import { TemplateMoveDialog } from '../dialogs/template-move-dialog';

export type TemplatesTableActionDropdownProps = {
  row: Template & {
    directLink?: Pick<TemplateDirectLink, 'token' | 'enabled'> | null;
    recipients: Recipient[];
  };
  templateRootPath: string;
  teamId?: number;
  onDelete?: () => Promise<void> | void;
  onMove?: ({
    templateId,
    teamUrl,
  }: {
    templateId: number;
    teamUrl: string;
  }) => Promise<void> | void;
};

export const TemplatesTableActionDropdown = ({
  row,
  templateRootPath,
  teamId,
  onDelete,
  onMove,
}: TemplatesTableActionDropdownProps) => {
  const { user } = useSession();

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isTemplateDirectLinkDialogOpen, setTemplateDirectLinkDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [isMoveDialogOpen, setMoveDialogOpen] = useState(false);

  const isOwner = row.userId === user.id;
  const isTeamTemplate = row.teamId === teamId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <MoreHorizontal className="text-muted-foreground h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="start" forceMount>
        <DropdownMenuLabel>Action</DropdownMenuLabel>

        <DropdownMenuItem disabled={!isOwner && !isTeamTemplate} asChild>
          <Link to={`${templateRootPath}/${row.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            <Trans>Edit</Trans>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={!isOwner && !isTeamTemplate}
          onClick={() => setDuplicateDialogOpen(true)}
        >
          <Copy className="mr-2 h-4 w-4" />
          <Trans>Duplicate</Trans>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setTemplateDirectLinkDialogOpen(true)}>
          <Share2Icon className="mr-2 h-4 w-4" />
          <Trans>Direct link</Trans>
        </DropdownMenuItem>

        {!teamId && !row.teamId && (
          <DropdownMenuItem onClick={() => setMoveDialogOpen(true)}>
            <MoveRight className="mr-2 h-4 w-4" />
            <Trans>Move to Team</Trans>
          </DropdownMenuItem>
        )}

        <TemplateBulkSendDialog
          templateId={row.id}
          recipients={row.recipients}
          trigger={
            <div className="hover:bg-accent hover:text-accent-foreground relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors">
              <Upload className="mr-2 h-4 w-4" />
              <Trans>Bulk Send via CSV</Trans>
            </div>
          }
        />

        <DropdownMenuItem
          disabled={!isOwner && !isTeamTemplate}
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <Trans>Delete</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <TemplateDuplicateDialog
        id={row.id}
        open={isDuplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />

      <TemplateDirectLinkDialog
        template={row}
        open={isTemplateDirectLinkDialogOpen}
        onOpenChange={setTemplateDirectLinkDialogOpen}
      />

      <TemplateMoveDialog
        templateId={row.id}
        open={isMoveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        onMove={onMove}
      />

      <TemplateDeleteDialog
        id={row.id}
        open={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDelete={onDelete}
      />
    </DropdownMenu>
  );
};
