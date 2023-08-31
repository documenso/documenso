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

import { Document, DocumentStatus, Recipient, User } from '@documenso/prisma/client';
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

  const onDownloadClick = () => {
    let decodedDocument = row.document;

    try {
      decodedDocument = atob(decodedDocument);
    } catch (err) {
      // We're just going to ignore this error and try to download the document
      console.error(err);
    }

    const documentBytes = Uint8Array.from(decodedDocument.split('').map((c) => c.charCodeAt(0)));

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

        <DropdownMenuItem disabled={!recipient} asChild>
          <Link href={`/sign/${recipient?.token}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Sign
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!isOwner} asChild>
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
