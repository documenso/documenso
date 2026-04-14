import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import {
  DocumentStatus,
  EnvelopeType,
  type Recipient,
  type TemplateDirectLink,
} from '@prisma/client';
import {
  Copy,
  Edit,
  FolderIcon,
  MoreHorizontal,
  Pencil,
  Share2Icon,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router';

import type { TRecipientLite } from '@documenso/lib/types/recipient';
import { trpc as trpcReact } from '@documenso/trpc/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { EnvelopeDeleteDialog } from '../dialogs/envelope-delete-dialog';
import { EnvelopeDuplicateDialog } from '../dialogs/envelope-duplicate-dialog';
import { EnvelopeRenameDialog } from '../dialogs/envelope-rename-dialog';
import { TemplateBulkSendDialog } from '../dialogs/template-bulk-send-dialog';
import { TemplateDirectLinkDialog } from '../dialogs/template-direct-link-dialog';
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
    recipients: TRecipientLite[];
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
  const trpcUtils = trpcReact.useUtils();

  const [isRenameDialogOpen, setRenameDialogOpen] = useState(false);
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

        {canMutate && (
          <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            <Trans>Rename</Trans>
          </DropdownMenuItem>
        )}

        {canMutate && (
          <EnvelopeDuplicateDialog
            envelopeId={row.envelopeId}
            envelopeType={EnvelopeType.TEMPLATE}
            trigger={
              <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                <div>
                  <Copy className="mr-2 h-4 w-4" />
                  <Trans>Duplicate</Trans>
                </div>
              </DropdownMenuItem>
            }
          />
        )}

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

        {canMutate && (
          <EnvelopeDeleteDialog
            id={row.envelopeId}
            type={EnvelopeType.TEMPLATE}
            status={DocumentStatus.DRAFT}
            title={row.title}
            canManageDocument={canMutate}
            onDelete={onDelete}
            trigger={
              <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                <div>
                  <Trash2 className="mr-2 h-4 w-4" />
                  <Trans>Delete</Trans>
                </div>
              </DropdownMenuItem>
            }
          />
        )}
      </DropdownMenuContent>

      <TemplateMoveToFolderDialog
        templateId={row.id}
        templateTitle={row.title}
        isOpen={isMoveToFolderDialogOpen}
        onOpenChange={setMoveToFolderDialogOpen}
        currentFolderId={row.folderId}
      />

      <EnvelopeRenameDialog
        id={row.envelopeId}
        initialTitle={row.title}
        open={isRenameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        envelopeType="template"
        onSuccess={async () => {
          await trpcUtils.template.findTemplates.invalidate();
        }}
      />
    </DropdownMenu>
  );
};
