'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Copy, Download, Edit, Loader, MoreHorizontal, Share, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { DocumentStatus } from '@documenso/prisma/client';
import type { Document, Recipient, Team, User } from '@documenso/prisma/client';
import { trpc as trpcClient } from '@documenso/trpc/client';
import { DocumentShareButton } from '@documenso/ui/components/document/document-share-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { ResendDocumentActionItem } from '../_action-items/resend-document';
import { DeleteDocumentDialog } from '../delete-document-dialog';
import { DuplicateDocumentDialog } from '../duplicate-document-dialog';

export type DocumentPageViewDropdownProps = {
  document: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
    team: Pick<Team, 'id' | 'url'> | null;
  };
  team?: Pick<Team, 'id' | 'url'>;
};

export const DocumentPageViewDropdown = ({ document, team }: DocumentPageViewDropdownProps) => {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  if (!session) {
    return null;
  }

  const recipient = document.Recipient.find((recipient) => recipient.email === session.user.email);

  const isOwner = document.User.id === session.user.id;
  const isDraft = document.status === DocumentStatus.DRAFT;
  const isComplete = document.status === DocumentStatus.COMPLETED;
  const isDocumentDeletable = isOwner;
  const isCurrentTeamDocument = team && document.team?.url === team.url;

  const documentsPath = formatDocumentsPath(team?.url);

  const onDownloadClick = async () => {
    try {
      const documentWithData = await trpcClient.document.getDocumentById.query({
        id: document.id,
        teamId: team?.id,
      });

      const documentData = documentWithData?.documentData;

      if (!documentData) {
        return;
      }

      await downloadPDF({ documentData, fileName: document.title });
    } catch (err) {
      toast({
        title: 'Something went wrong',
        description: 'An error occurred while downloading your document.',
        variant: 'destructive',
      });
    }
  };

  const nonSignedRecipients = document.Recipient.filter((item) => item.signingStatus !== 'SIGNED');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <MoreHorizontal className="text-muted-foreground h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="end" forceMount>
        <DropdownMenuLabel>Action</DropdownMenuLabel>

        {(isOwner || isCurrentTeamDocument) && !isComplete && (
          <DropdownMenuItem asChild>
            <Link href={`${documentsPath}/${document.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </DropdownMenuItem>
        )}

        {isComplete && (
          <DropdownMenuItem onClick={onDownloadClick}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => setDuplicateDialogOpen(true)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} disabled={!isDocumentDeletable}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>

        <DropdownMenuLabel>Share</DropdownMenuLabel>

        <ResendDocumentActionItem
          document={document}
          recipients={nonSignedRecipients}
          team={team}
        />

        <DocumentShareButton
          documentId={document.id}
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
          id={document.id}
          status={document.status}
          documentTitle={document.title}
          open={isDeleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
        />
      )}
      {isDuplicateDialogOpen && (
        <DuplicateDocumentDialog
          id={document.id}
          open={isDuplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
          team={team}
        />
      )}
    </DropdownMenu>
  );
};
