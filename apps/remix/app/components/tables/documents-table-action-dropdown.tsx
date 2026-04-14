import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, EnvelopeType, RecipientRole } from '@prisma/client';
import {
  CheckCircle,
  Copy,
  Download,
  Edit,
  EyeIcon,
  FileOutputIcon,
  FolderInput,
  Loader,
  MoreHorizontal,
  Pencil,
  Share,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import type { TDocumentMany as TDocumentRow } from '@documenso/lib/types/document';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { getEnvelopeItemPermissions } from '@documenso/lib/utils/envelope';
import { findRecipientByEmail } from '@documenso/lib/utils/recipients';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { DocumentShareButton } from '@documenso/ui/components/document/document-share-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { DocumentResendDialog } from '~/components/dialogs/document-resend-dialog';
import { EnvelopeDeleteDialog } from '~/components/dialogs/envelope-delete-dialog';
import { EnvelopeDuplicateDialog } from '~/components/dialogs/envelope-duplicate-dialog';
import { EnvelopeSaveAsTemplateDialog } from '~/components/dialogs/envelope-save-as-template-dialog';
import { DocumentRecipientLinkCopyDialog } from '~/components/general/document/document-recipient-link-copy-dialog';
import { useCurrentTeam } from '~/providers/team';

import { EnvelopeDownloadDialog } from '../dialogs/envelope-download-dialog';
import { EnvelopeRenameDialog } from '../dialogs/envelope-rename-dialog';

export type DocumentsTableActionDropdownProps = {
  row: TDocumentRow;
  onMoveDocument?: () => void;
};

export const DocumentsTableActionDropdown = ({
  row,
  onMoveDocument,
}: DocumentsTableActionDropdownProps) => {
  const { user } = useSession();
  const team = useCurrentTeam();

  const { _ } = useLingui();
  const trpcUtils = trpcReact.useUtils();

  const [isRenameDialogOpen, setRenameDialogOpen] = useState(false);
  const [isSaveAsTemplateDialogOpen, setSaveAsTemplateDialogOpen] = useState(false);

  const recipient = findRecipientByEmail({
    recipients: row.recipients,
    userEmail: user.email,
    teamEmail: team.teamEmail?.email,
  });

  const isOwner = row.user.id === user.id;
  // const isRecipient = !!recipient;
  const isDraft = row.status === DocumentStatus.DRAFT;
  const isPending = row.status === DocumentStatus.PENDING;
  const isComplete = isDocumentCompleted(row.status);
  // const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
  const isCurrentTeamDocument = team && row.team?.url === team.url;
  const canManageDocument = Boolean(isOwner || isCurrentTeamDocument);

  const { canTitleBeChanged } = getEnvelopeItemPermissions(
    {
      completedAt: row.completedAt,
      deletedAt: row.deletedAt,
      type: EnvelopeType.DOCUMENT,
      status: row.status,
    },
    [],
  );

  const documentsPath = formatDocumentsPath(team.url);
  const formatPath = `${documentsPath}/${row.envelopeId}/edit`;

  const nonSignedRecipients = row.recipients.filter((item) => item.signingStatus !== 'SIGNED');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="document-table-action-btn">
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="start" forceMount>
        <DropdownMenuLabel>
          <Trans>Action</Trans>
        </DropdownMenuLabel>

        {!isDraft &&
          recipient &&
          recipient?.role !== RecipientRole.CC &&
          recipient?.role !== RecipientRole.ASSISTANT && (
            <DropdownMenuItem disabled={!recipient || isComplete} asChild>
              <Link to={`/sign/${recipient?.token}`}>
                {recipient?.role === RecipientRole.VIEWER && (
                  <>
                    <EyeIcon className="mr-2 h-4 w-4" />
                    <Trans>View</Trans>
                  </>
                )}

                {recipient?.role === RecipientRole.SIGNER && (
                  <>
                    <Pencil className="mr-2 h-4 w-4" />
                    <Trans>Sign</Trans>
                  </>
                )}

                {recipient?.role === RecipientRole.APPROVER && (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    <Trans>Approve</Trans>
                  </>
                )}
              </Link>
            </DropdownMenuItem>
          )}

        <DropdownMenuItem disabled={!canManageDocument || isComplete} asChild>
          <Link to={formatPath}>
            <Edit className="mr-2 h-4 w-4" />
            <Trans>Edit</Trans>
          </Link>
        </DropdownMenuItem>

        {canManageDocument && canTitleBeChanged && (
          <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            <Trans>Rename</Trans>
          </DropdownMenuItem>
        )}

        <EnvelopeDownloadDialog
          envelopeId={row.envelopeId}
          envelopeStatus={row.status}
          token={recipient?.token}
          trigger={
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <div>
                <Download className="mr-2 h-4 w-4" />
                <Trans>Download</Trans>
              </div>
            </DropdownMenuItem>
          }
        />

        <EnvelopeDuplicateDialog
          envelopeId={row.envelopeId}
          envelopeType={EnvelopeType.DOCUMENT}
          trigger={
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <div>
                <Copy className="mr-2 h-4 w-4" />
                <Trans>Duplicate</Trans>
              </div>
            </DropdownMenuItem>
          }
        />

        <DropdownMenuItem onClick={() => setSaveAsTemplateDialogOpen(true)}>
          <FileOutputIcon className="mr-2 h-4 w-4" />
          <Trans>Save as Template</Trans>
        </DropdownMenuItem>

        {onMoveDocument && canManageDocument && (
          <DropdownMenuItem onClick={onMoveDocument} onSelect={(e) => e.preventDefault()}>
            <FolderInput className="mr-2 h-4 w-4" />
            <Trans>Move to Folder</Trans>
          </DropdownMenuItem>
        )}

        {/* No point displaying this if there's no functionality. */}
        {/* <DropdownMenuItem disabled>
          <XCircle className="mr-2 h-4 w-4" />
          Void
        </DropdownMenuItem> */}

        <EnvelopeDeleteDialog
          id={row.envelopeId}
          type={EnvelopeType.DOCUMENT}
          status={row.status}
          title={row.title}
          canManageDocument={canManageDocument}
          trigger={
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <div>
                <Trash2 className="mr-2 h-4 w-4" />
                {canManageDocument ? _(msg`Delete`) : _(msg`Hide`)}
              </div>
            </DropdownMenuItem>
          }
        />

        <DropdownMenuLabel>
          <Trans>Share</Trans>
        </DropdownMenuLabel>

        {canManageDocument && (
          <DocumentRecipientLinkCopyDialog
            recipients={row.recipients}
            trigger={
              <DropdownMenuItem disabled={!isPending} asChild onSelect={(e) => e.preventDefault()}>
                <div>
                  <Copy className="mr-2 h-4 w-4" />
                  <Trans>Signing Links</Trans>
                </div>
              </DropdownMenuItem>
            }
          />
        )}

        <DocumentResendDialog document={row} recipients={nonSignedRecipients} />

        <DocumentShareButton
          documentId={row.id}
          token={isOwner ? undefined : recipient?.token}
          trigger={({ loading, disabled }) => (
            <DropdownMenuItem disabled={disabled || isDraft} onSelect={(e) => e.preventDefault()}>
              <div className="flex items-center">
                {loading ? <Loader className="mr-2 h-4 w-4" /> : <Share className="mr-2 h-4 w-4" />}
                <Trans>Share Signing Card</Trans>
              </div>
            </DropdownMenuItem>
          )}
        />
      </DropdownMenuContent>

      <EnvelopeSaveAsTemplateDialog
        envelopeId={row.envelopeId}
        open={isSaveAsTemplateDialogOpen}
        onOpenChange={setSaveAsTemplateDialogOpen}
      />

      <EnvelopeRenameDialog
        id={row.envelopeId}
        initialTitle={row.title}
        open={isRenameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        onSuccess={async () => {
          await trpcUtils.document.findDocumentsInternal.invalidate();
        }}
      />
    </DropdownMenu>
  );
};
