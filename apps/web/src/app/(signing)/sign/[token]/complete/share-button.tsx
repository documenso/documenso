'use client';

import { HTMLAttributes } from 'react';

import { useRouter } from 'next/navigation';

import { Share } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';

export type ShareButtonProps = HTMLAttributes<HTMLButtonElement> & {
  recipientId: number;
  documentId: number;
};

export const ShareButton = ({ recipientId, documentId }: ShareButtonProps) => {
  const { mutateAsync: createShareId } = trpc.share.create.useMutation();

  const router = useRouter();

  return (
    <Button
      variant="outline"
      className="flex-1"
      onClick={async () => {
        // redirect to the share page
        // create link once and dont allow a user to create the link
        const response = await createShareId({
          recipientId,
          documentId,
        });

        return router.push(`/share/${response.link}`);
      }}
    >
      <Share className="mr-2 h-5 w-5" />
      Share
    </Button>
  );
};
