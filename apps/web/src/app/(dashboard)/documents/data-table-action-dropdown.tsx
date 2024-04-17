'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
<<<<<<< HEAD
  Copy,
  Download,
  Edit,
  History,
=======
  CheckCircle,
  Copy,
  Download,
  Edit,
  EyeIcon,
>>>>>>> main
  Loader,
  MoreHorizontal,
  Pencil,
  Share,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useSession } from 'next-auth/react';

<<<<<<< HEAD
import { useCopyShareLink } from '@documenso/lib/client-only/hooks/use-copy-share-link';
import {
  TOAST_DOCUMENT_SHARE_ERROR,
  TOAST_DOCUMENT_SHARE_SUCCESS,
} from '@documenso/lib/constants/toast';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { Document, DocumentStatus, Recipient, User } from '@documenso/prisma/client';
import { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { trpc as trpcClient } from '@documenso/trpc/client';
=======
import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { DocumentStatus, RecipientRole } from '@documenso/prisma/client';
import type { Document, Recipient, Team, User } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { trpc as trpcClient } from '@documenso/trpc/client';
import { DocumentShareButton } from '@documenso/ui/components/document/document-share-button';
>>>>>>> main
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';

<<<<<<< HEAD
import { DeleteDraftDocumentDialog } from './delete-draft-document-dialog';
=======
import { ResendDocumentActionItem } from './_action-items/resend-document';
import { DeleteDocumentDialog } from './delete-document-dialog';
import { DuplicateDocumentDialog } from './duplicate-document-dialog';
>>>>>>> main

export type DataTableActionDropdownProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
<<<<<<< HEAD
  };
};

export const DataTableActionDropdown = ({ row }: DataTableActionDropdownProps) => {
  const { data: session } = useSession();

  const { toast } = useToast();

  const { createAndCopyShareLink, isCopyingShareLink } = useCopyShareLink({
    onSuccess: () => toast(TOAST_DOCUMENT_SHARE_SUCCESS),
    onError: () => toast(TOAST_DOCUMENT_SHARE_ERROR),
  });

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
=======
    team: Pick<Team, 'id' | 'url'> | null;
  };
  team?: Pick<Team, 'id' | 'url'>;
};

export const DataTableActionDropdown = ({ row, team }: DataTableActionDropdownProps) => {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
>>>>>>> main

  if (!session) {
    return null;
  }

  const recipient = row.Recipient.find((recipient) => recipient.email === session.user.email);

  const isOwner = row.User.id === session.user.id;
  // const isRecipient = !!recipient;
  const isDraft = row.status === DocumentStatus.DRAFT;
  // const isPending = row.status === DocumentStatus.PENDING;
  const isComplete = row.status === DocumentStatus.COMPLETED;
  // const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;
<<<<<<< HEAD
  const isDocumentDeletable = isOwner && row.status === DocumentStatus.DRAFT;

  const onDownloadClick = async () => {
    let document: DocumentWithData | null = null;

    if (!recipient) {
      document = await trpcClient.document.getDocumentById.query({
        id: row.id,
      });
    } else {
      document = await trpcClient.document.getDocumentByToken.query({
        token: recipient.token,
      });
    }

    const documentData = document?.documentData;

    if (!documentData) {
      return;
    }

    const documentBytes = await getFile(documentData);

    const blob = new Blob([documentBytes], {
      type: 'application/pdf',
    });

    const link = window.document.createElement('a');

    link.href = window.URL.createObjectURL(blob);
    link.download = row.title || 'document.pdf';

    link.click();

    window.URL.revokeObjectURL(link.href);
  };

=======
  const isDocumentDeletable = isOwner;
  const isCurrentTeamDocument = team && row.team?.url === team.url;

  const documentsPath = formatDocumentsPath(team?.url);

  const onDownloadClick = async () => {
    try {
      let document: DocumentWithData | null = null;

      if (!recipient) {
        document = await trpcClient.document.getDocumentById.query({
          id: row.id,
          teamId: team?.id,
        });
      } else {
        document = await trpcClient.document.getDocumentByToken.query({
          token: recipient.token,
        });
      }

      const documentData = document?.documentData;

      if (!documentData) {
        return;
      }

      await downloadPDF({ documentData, fileName: row.title });
    } catch (err) {
      toast({
        title: 'Something went wrong',
        description: 'An error occurred while downloading your document.',
        variant: 'destructive',
      });
    }
  };

  const nonSignedRecipients = row.Recipient.filter((item) => item.signingStatus !== 'SIGNED');

>>>>>>> main
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <MoreHorizontal className="text-muted-foreground h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="start" forceMount>
        <DropdownMenuLabel>Action</DropdownMenuLabel>

<<<<<<< HEAD
        <DropdownMenuItem disabled={!recipient || isComplete} asChild>
          <Link href={`/sign/${recipient?.token}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Sign
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!isOwner || isComplete} asChild>
          <Link href={`/documents/${row.id}`}>
=======
        {recipient && recipient?.role !== RecipientRole.CC && (
          <DropdownMenuItem disabled={!recipient || isComplete} asChild>
            <Link href={`/sign/${recipient?.token}`}>
              {recipient?.role === RecipientRole.VIEWER && (
                <>
                  <EyeIcon className="mr-2 h-4 w-4" />
                  View
                </>
              )}

              {recipient?.role === RecipientRole.SIGNER && (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Sign
                </>
              )}

              {recipient?.role === RecipientRole.APPROVER && (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </>
              )}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem disabled={(!isOwner && !isCurrentTeamDocument) || isComplete} asChild>
          <Link href={`${documentsPath}/${row.id}/edit`}>
>>>>>>> main
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!isComplete} onClick={onDownloadClick}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </DropdownMenuItem>

<<<<<<< HEAD
        <DropdownMenuItem disabled>
=======
        <DropdownMenuItem onClick={() => setDuplicateDialogOpen(true)}>
>>>>>>> main
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem disabled>
          <XCircle className="mr-2 h-4 w-4" />
          Void
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} disabled={!isDocumentDeletable}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>

        <DropdownMenuLabel>Share</DropdownMenuLabel>

<<<<<<< HEAD
        <DropdownMenuItem disabled>
          <History className="mr-2 h-4 w-4" />
          Resend
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={isDraft}
          onClick={async () =>
            createAndCopyShareLink({
              token: recipient?.token,
              documentId: row.id,
            })
          }
        >
          {isCopyingShareLink ? (
            <Loader className="mr-2 h-4 w-4" />
          ) : (
            <Share className="mr-2 h-4 w-4" />
          )}
          Share
        </DropdownMenuItem>
      </DropdownMenuContent>

      {isDocumentDeletable && (
        <DeleteDraftDocumentDialog
          id={row.id}
          open={isDeleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
=======
        <ResendDocumentActionItem document={row} recipients={nonSignedRecipients} team={team} />

        <DocumentShareButton
          documentId={row.id}
          token={isOwner ? undefined : recipient?.token}
          trigger={({ loading, disabled }) => (
            <DropdownMenuItem disabled={disabled || isDraft} onSelect={(e) => e.preventDefault()}>
              <div className="flex items-center">
                {loading ? <Loader className="mr-2 h-4 w-4" /> : <Share className="mr-2 h-4 w-4" />}
                Share Signing Card
              </div>
            </DropdownMenuItem>
          )}
        />
      </DropdownMenuContent>

      {isDocumentDeletable && (
        <DeleteDocumentDialog
          id={row.id}
          status={row.status}
          documentTitle={row.title}
          open={isDeleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          teamId={team?.id}
        />
      )}
      {isDuplicateDialogOpen && (
        <DuplicateDocumentDialog
          id={row.id}
          open={isDuplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
          team={team}
>>>>>>> main
        />
      )}
    </DropdownMenu>
  );
};
