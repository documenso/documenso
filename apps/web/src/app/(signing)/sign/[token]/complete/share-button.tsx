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
  const { mutateAsync: createShareId, isLoading } = trpc.share.create.useMutation();

  const router = useRouter();

  return (
    <Button
      variant="outline"
      className="flex-1"
      disabled={!recipientId || !documentId || isLoading}
      onClick={async () => {
        console.log('Signing Clicked');

        const response = await createShareId({
          recipientId,
          documentId,
        });

        console.log('response', response);

        // TODO: Router delaying...
        return router.push(`/share/${response.link}`);
      }}
    >
      <Share className="mr-2 h-5 w-5" />
      Share
    </Button>
  );
};
