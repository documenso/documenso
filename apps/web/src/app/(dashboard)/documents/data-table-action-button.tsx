'use client';

import Link from 'next/link';

import { Download, Edit, Pencil } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import type { Document, Recipient, User } from '@documenso/prisma/client';
import { DocumentStatus, SigningStatus } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { trpc as trpcClient } from '@documenso/trpc/client';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DataTableActionButtonProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
  };
};

export const DataTableActionButton = ({ row }: DataTableActionButtonProps) => {
  const { data: session } = useSession();
  const { toast } = useToast();

  if (!session) {
    return null;
  }

  const recipient = row.Recipient.find((recipient) => recipient.email === session.user.email);

  const isOwner = row.User.id === session.user.id;
  const isRecipient = !!recipient;
  const isDraft = row.status === DocumentStatus.DRAFT;
  const isPending = row.status === DocumentStatus.PENDING;
  const isComplete = row.status === DocumentStatus.COMPLETED;
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;

  const onDownloadClick = async () => {
    try {
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
        throw Error('No document available');
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

  return match({
    isOwner,
    isRecipient,
    isDraft,
    isPending,
    isComplete,
    isSigned,
  })
    .with({ isOwner: true, isDraft: true }, () => (
      <Button className="w-32" asChild>
        <Link href={`/documents/${row.id}`}>
          <Edit className="-ml-1 mr-2 h-4 w-4" />
          Edit
        </Link>
      </Button>
    ))
    .with({ isRecipient: true, isPending: true, isSigned: false }, () => (
      <Button className="w-32" asChild>
        <Link href={`/sign/${recipient?.token}`}>
          <Pencil className="-ml-1 mr-2 h-4 w-4" />
          Sign
        </Link>
      </Button>
    ))
    .with({ isPending: true, isSigned: true }, () => (
      <Button className="w-32" disabled={true}>
        <Pencil className="-ml-1 mr-2 inline h-4 w-4" />
        Sign
      </Button>
    ))
    .with({ isComplete: true }, () => (
      <Button className="w-32" onClick={onDownloadClick}>
        <Download className="-ml-1 mr-2 inline h-4 w-4" />
        Download
      </Button>
    ))
    .otherwise(() => <div></div>);
};
