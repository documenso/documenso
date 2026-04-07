import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import {
  Copy,
  Download,
  Edit,
  FileOutputIcon,
  Loader,
  MoreHorizontal,
  Pencil,
  ScrollTextIcon,
  Share,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import {
  getEnvelopeItemPermissions,
  mapSecondaryIdToDocumentId,
} from '@documenso/lib/utils/envelope';
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

import { DocumentDeleteDialog } from '~/components/dialogs/document-delete-dialog';
import { DocumentDuplicateDialog } from '~/components/dialogs/document-duplicate-dialog';
import { DocumentResendDialog } from '~/components/dialogs/document-resend-dialog';
import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { EnvelopeRenameDialog } from '~/components/dialogs/envelope-rename-dialog';
import { EnvelopeSaveAsTemplateDialog } from '~/components/dialogs/envelope-save-as-template-dialog';
import { DocumentRecipientLinkCopyDialog } from '~/components/general/document/document-recipient-link-copy-dialog';
import { useCurrentTeam } from '~/providers/team';

export type DocumentPageViewDropdownProps = {
  envelope: TEnvelope;
};

export const DocumentPageViewDropdown = ({ envelope }: DocumentPageViewDropdownProps) => {
  const { user } = useSession();

  const navigate = useNavigate();
  const team = useCurrentTeam();

  const trpcUtils = trpcReact.useUtils();

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [isRenameDialogOpen, setRenameDialogOpen] = useState(false);

  const recipient = envelope.recipients.find((recipient) => recipient.email === user.email);

  const isOwner = envelope.userId === user.id;
  const isDraft = envelope.status === DocumentStatus.DRAFT;
  const isPending = envelope.status === DocumentStatus.PENDING;
  const isDeleted = envelope.deletedAt !== null;
  const isComplete = isDocumentCompleted(envelope);
  const isCurrentTeamDocument = team && envelope.teamId === team.id;
  const canManageDocument = Boolean(isOwner || isCurrentTeamDocument);

  const { canTitleBeChanged } = getEnvelopeItemPermissions(envelope, []);

  const documentsPath = formatDocumentsPath(team.url);

  const nonSignedRecipients = envelope.recipients.filter((item) => item.signingStatus !== 'SIGNED');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="document-page-view-action-btn">
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="end" forceMount>
        <DropdownMenuLabel>
          <Trans>Action</Trans>
        </DropdownMenuLabel>

        {(isOwner || isCurrentTeamDocument) && !isComplete && (
          <DropdownMenuItem asChild>
            <Link to={`${documentsPath}/${envelope.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              <Trans>Edit</Trans>
            </Link>
          </DropdownMenuItem>
        )}

        {canManageDocument && canTitleBeChanged && (
          <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            <Trans>Rename</Trans>
          </DropdownMenuItem>
        )}

        <EnvelopeDownloadDialog
          envelopeId={envelope.id}
          envelopeStatus={envelope.status}
          token={recipient?.token}
          envelopeItems={envelope.envelopeItems}
          trigger={
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <div>
                <Download className="mr-2 h-4 w-4" />
                <Trans>Download</Trans>
              </div>
            </DropdownMenuItem>
          }
        />

        <DropdownMenuItem asChild>
          <Link to={`${documentsPath}/${envelope.id}/logs`}>
            <ScrollTextIcon className="mr-2 h-4 w-4" />
            <Trans>Audit Logs</Trans>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setDuplicateDialogOpen(true)}>
          <Copy className="mr-2 h-4 w-4" />
          <Trans>Duplicate</Trans>
        </DropdownMenuItem>

        <EnvelopeSaveAsTemplateDialog
          envelopeId={envelope.id}
          trigger={
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <div>
                <FileOutputIcon className="mr-2 h-4 w-4" />
                <Trans>Save as Template</Trans>
              </div>
            </DropdownMenuItem>
          }
        />

        <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} disabled={isDeleted}>
          <Trash2 className="mr-2 h-4 w-4" />
          <Trans>Delete</Trans>
        </DropdownMenuItem>

        <DropdownMenuLabel>
          <Trans>Share</Trans>
        </DropdownMenuLabel>

        {canManageDocument && (
          <DocumentRecipientLinkCopyDialog
            recipients={envelope.recipients}
            trigger={
              <DropdownMenuItem
                disabled={!isPending || isDeleted}
                onSelect={(e) => e.preventDefault()}
              >
                <Copy className="mr-2 h-4 w-4" />
                <Trans>Signing Links</Trans>
              </DropdownMenuItem>
            }
          />
        )}

        <DocumentResendDialog
          document={{
            ...envelope,
            id: mapSecondaryIdToDocumentId(envelope.secondaryId),
          }}
          recipients={nonSignedRecipients}
        />

        <DocumentShareButton
          documentId={mapSecondaryIdToDocumentId(envelope.secondaryId)}
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

      <DocumentDeleteDialog
        id={mapSecondaryIdToDocumentId(envelope.secondaryId)}
        status={envelope.status}
        documentTitle={envelope.title}
        open={isDeleteDialogOpen}
        canManageDocument={canManageDocument}
        onOpenChange={setDeleteDialogOpen}
        onDelete={() => {
          void navigate(documentsPath);
        }}
      />

      {isDuplicateDialogOpen && (
        <DocumentDuplicateDialog
          id={envelope.id}
          token={recipient?.token}
          open={isDuplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
        />
      )}

      <EnvelopeRenameDialog
        id={envelope.id}
        initialTitle={envelope.title}
        open={isRenameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        onSuccess={async () => {
          await trpcUtils.envelope.get.invalidate();
        }}
      />
    </DropdownMenu>
  );
};
