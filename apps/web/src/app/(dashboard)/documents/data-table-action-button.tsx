'use client';

import Link from 'next/link';

import { Edit, Pencil, Share } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

import { Document, DocumentStatus, Recipient, SigningStatus, User } from '@documenso/prisma/client';
import { DocumentShareButton } from '@documenso/ui/components/document/document-share-button';
import { Button } from '@documenso/ui/primitives/button';

export type DataTableActionButtonProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
  };
};

export const DataTableActionButton = ({ row }: DataTableActionButtonProps) => {
  const { data: session } = useSession();

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

  return match({
    isOwner,
    isRecipient,
    isDraft,
    isPending,
    isComplete,
    isSigned,
  })
    .with({ isOwner: true, isDraft: true }, () => (
      <Button className="w-24" asChild>
        <Link href={`/documents/${row.id}`}>
          <Edit className="-ml-1 mr-2 h-4 w-4" />
          Edit
        </Link>
      </Button>
    ))
    .with({ isRecipient: true, isPending: true, isSigned: false }, () => (
      <Button className="w-24" asChild>
        <Link href={`/sign/${recipient?.token}`}>
          <Pencil className="-ml-1 mr-2 h-4 w-4" />
          Sign
        </Link>
      </Button>
    ))
    .otherwise(() => (
      <DocumentShareButton
        documentId={row.id}
        token={recipient?.token}
        trigger={({ loading }) => (
          <Button className="w-24" loading={loading}>
            {!loading && <Share className="-ml-1 mr-2 h-4 w-4" />}
            Share
          </Button>
        )}
      />
    ));
};
