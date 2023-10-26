'use client';

import Link from 'next/link';

import { Edit, Pencil, Share } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

import { useCopyShareLink } from '@documenso/lib/client-only/hooks/use-copy-share-link';
import {
  TOAST_DOCUMENT_SHARE_ERROR,
  TOAST_DOCUMENT_SHARE_SUCCESS,
} from '@documenso/lib/constants/toast';
import { Document, DocumentStatus, Recipient, SigningStatus, User } from '@documenso/prisma/client';
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

  const { createAndCopyShareLink, isCopyingShareLink } = useCopyShareLink({
    onSuccess: () => toast(TOAST_DOCUMENT_SHARE_SUCCESS),
    onError: () => toast(TOAST_DOCUMENT_SHARE_ERROR),
  });

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
      <Button
        className="w-24"
        loading={isCopyingShareLink}
        onClick={async () =>
          createAndCopyShareLink({
            token: recipient?.token,
            documentId: row.id,
          })
        }
      >
        {!isCopyingShareLink && <Share className="-ml-1 mr-2 h-4 w-4" />}
        Share
      </Button>
    ));
};
