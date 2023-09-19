'use client';

import Link from 'next/link';

import {
  Copy,
  Download,
  Edit,
  History,
  MoreHorizontal,
  Pencil,
  Share,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useSession } from 'next-auth/react';

import { getFile } from '@documenso/lib/universal/upload/get-file';
import { Document, DocumentStatus, Recipient, User } from '@documenso/prisma/client';
import { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { trpc } from '@documenso/trpc/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

export type DataTableActionDropdownProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
  };
};

export const DataTableActionDropdown = ({ row }: DataTableActionDropdownProps) => {
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  const recipient = row.Recipient.find((recipient) => recipient.email === session.user.email);

  const isOwner = row.User.id === session.user.id;
  // const isRecipient = !!recipient;
  // const isDraft = row.status === DocumentStatus.DRAFT;
  // const isPending = row.status === DocumentStatus.PENDING;
  const isComplete = row.status === DocumentStatus.COMPLETED;
  // const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;

  const onDownloadClick = async () => {
    let document: DocumentWithData | null = null;

    if (!recipient) {
      document = await trpc.document.getDocumentById.query({
        id: row.id,
      });
    } else {
      document = await trpc.document.getDocumentByToken.query({
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <MoreHorizontal className="h-5 w-5 text-gray-500" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="start" forceMount>
        <DropdownMenuLabel>Action</DropdownMenuLabel>

        <DropdownMenuItem disabled={!recipient || isComplete} asChild>
          <Link href={`/sign/${recipient?.token}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Sign
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!isOwner || isComplete} asChild>
          <Link href={`/documents/${row.id}`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!isComplete} onClick={onDownloadClick}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </DropdownMenuItem>

        <DropdownMenuItem disabled>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem disabled>
          <XCircle className="mr-2 h-4 w-4" />
          Void
        </DropdownMenuItem>

        <DropdownMenuItem disabled>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>

        <DropdownMenuLabel>Share</DropdownMenuLabel>

        <DropdownMenuItem disabled>
          <History className="mr-2 h-4 w-4" />
          Resend
        </DropdownMenuItem>

        <DropdownMenuItem disabled>
          <Share className="mr-2 h-4 w-4" />
          Share
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
