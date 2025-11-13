import { useState } from 'react';

import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import {
  Copy,
  Download,
  Edit,
  Loader,
  MoreHorizontal,
  ScrollTextIcon,
  Share,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { DocumentShareButton } from '@documenso/ui/components/document/document-share-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { DocumentDeleteDialog } from '~/components/dialogs/document-delete-dialog';
import { DocumentDuplicateDialog } from '~/components/dialogs/document-duplicate-dialog';
import { DocumentResendDialog } from '~/components/dialogs/document-resend-dialog';
import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { DocumentRecipientLinkCopyDialog } from '~/components/general/document/document-recipient-link-copy-dialog';
import { useCurrentTeam } from '~/providers/team';

export type DocumentPageViewDropdownProps = {
  envelope: TEnvelope;
};

export const DocumentPageViewDropdown = ({ envelope }: DocumentPageViewDropdownProps) => {
  const { user } = useSession();
  const { toast } = useToast();
  const { _ } = useLingui();

  const navigate = useNavigate();
  const team = useCurrentTeam();

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  const recipient = envelope.recipients.find((recipient) => recipient.email === user.email);

  const isOwner = envelope.userId === user.id;
  const isDraft = envelope.status === DocumentStatus.DRAFT;
  const isPending = envelope.status === DocumentStatus.PENDING;
  const isDeleted = envelope.deletedAt !== null;
  const isComplete = isDocumentCompleted(envelope);
  const isCurrentTeamDocument = team && envelope.teamId === team.id;
  const canManageDocument = Boolean(isOwner || isCurrentTeamDocument);

  const documentsPath = formatDocumentsPath(team.url);

  const nonSignedRecipients = envelope.recipients.filter((item) => item.signingStatus !== 'SIGNED');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <MoreHorizontal className="text-muted-foreground h-5 w-5" />
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
    </DropdownMenu>
  );
};
