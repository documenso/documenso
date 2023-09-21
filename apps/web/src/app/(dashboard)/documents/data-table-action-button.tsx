'use client';

import Link from 'next/link';

import { Edit, Pencil, Share } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { match } from 'ts-pattern';

import { Document, DocumentStatus, Recipient, SigningStatus, User } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';

export type DataTableActionButtonProps = {
  row: Document & {
    User: Pick<User, 'id' | 'name' | 'email'>;
    Recipient: Recipient[];
  };
};

export const DataTableActionButton = ({ row }: DataTableActionButtonProps) => {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [, copyToClipboard] = useCopyToClipboard();

  if (!session) {
    return null;
  }

  const { mutateAsync: createOrGetShareLink, isLoading: isCreatingShareLink } =
    trpc.shareLink.createOrGetShareLink.useMutation();

  const recipient = row.Recipient.find((recipient) => recipient.email === session.user.email);

  const isOwner = row.User.id === session.user.id;
  const isRecipient = !!recipient;
  const isDraft = row.status === DocumentStatus.DRAFT;
  const isPending = row.status === DocumentStatus.PENDING;
  const isComplete = row.status === DocumentStatus.COMPLETED;
  const isSigned = recipient?.signingStatus === SigningStatus.SIGNED;

  const onShareClick = async () => {
    const { slug } = await createOrGetShareLink({
      token: recipient?.token,
      documentId: row.id,
    });

    await copyToClipboard(`${window.location.origin}/share/${slug}`).catch(() => null);

    toast({
      title: 'Copied to clipboard',
      description: 'The sharing link has been copied to your clipboard.',
    });
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
      <Button className="w-24" loading={isCreatingShareLink} onClick={onShareClick}>
        {!isCreatingShareLink && <Share className="-ml-1 mr-2 h-4 w-4" />}
        Share
      </Button>
    ));
};
