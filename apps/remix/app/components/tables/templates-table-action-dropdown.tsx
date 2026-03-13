import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { Recipient, TemplateDirectLink } from '@prisma/client';
import { Copy, Edit, FolderIcon, MoreHorizontal, Share2Icon, Trash2, Upload } from 'lucide-react';
import { Link } from 'react-router';

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
import { TemplateMoveToFolderDialog } from '../dialogs/template-move-to-folder-dialog';

export type TemplatesTableActionDropdownProps = {
  row: {
    id: number;
    userId: number;
    teamId: number;
    title: string;
    folderId?: string | null;
    envelopeId: string;
    directLink?: Pick<TemplateDirectLink, 'token' | 'enabled'> | null;
    recipients: Recipient[];
  };
  templateRootPath: string;
  teamId: number;
  onDelete?: () => Promise<void> | void;
};

export const TemplatesTableActionDropdown = ({
  row,
  templateRootPath,
  teamId,
  onDelete,
}: TemplatesTableActionDropdownProps) => {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [isMoveToFolderDialogOpen, setMoveToFolderDialogOpen] = useState(false);

  const isTeamTemplate = row.teamId === teamId;
  const canMutate = isTeamTemplate;

  const formatPath = `${templateRootPath}/${row.envelopeId}/edit`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="template-table-action-btn">
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="start" forceMount>
        <DropdownMenuLabel>Action</DropdownMenuLabel>

        <DropdownMenuItem disabled={!canMutate} asChild>
          <Link to={formatPath}>
            <Edit className="mr-2 h-4 w-4" />
            <Trans>Edit</Trans>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!canMutate} onClick={() => setDuplicateDialogOpen(true)}>
          <Copy className="mr-2 h-4 w-4" />
          <Trans>Duplicate</Trans>
        </DropdownMenuItem>

        {canMutate && (
          <TemplateDirectLinkDialog
            templateId={row.id}
            recipients={row.recipients}
            directLink={row.directLink}
            trigger={
              <div
                data-testid="template-direct-link"
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Share2Icon className="mr-2 h-4 w-4" />
                <Trans>Direct link</Trans>
              </div>
            }
          />
        )}

        <DropdownMenuItem disabled={!canMutate} onClick={() => setMoveToFolderDialogOpen(true)}>
          <FolderIcon className="mr-2 h-4 w-4" />
          <Trans>Move to Folder</Trans>
        </DropdownMenuItem>

        {canMutate && (
          <TemplateBulkSendDialog
            templateId={row.id}
            recipients={row.recipients}
            trigger={
              <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                <Upload className="mr-2 h-4 w-4" />
                <Trans>Bulk Send via CSV</Trans>
              </div>
            }
          />
        )}

        <DropdownMenuItem disabled={!canMutate} onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          <Trans>Delete</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <TemplateDuplicateDialog
        id={row.id}
        open={isDuplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />

      <TemplateDeleteDialog
        id={row.id}
        open={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDelete={onDelete}
      />

      <TemplateMoveToFolderDialog
        templateId={row.id}
        templateTitle={row.title}
        isOpen={isMoveToFolderDialogOpen}
        onOpenChange={setMoveToFolderDialogOpen}
        currentFolderId={row.folderId}
      />
    </DropdownMenu>
  );
};
