'use client';

import { HTMLAttributes } from 'react';

import { useRouter } from 'next/navigation';

import { Share } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';

export type ShareButtonProps = HTMLAttributes<HTMLButtonElement> & {
  token: string;
  documentId: number;
};

export const ShareButton = ({ token, documentId }: ShareButtonProps) => {
  const { mutateAsync: createOrGetShareLink, isLoading } =
    trpc.shareLink.createOrGetShareLink.useMutation();

  const router = useRouter();

  return (
    <Button
      variant="outline"
      className="flex-1"
      disabled={!token || !documentId || isLoading}
      onClick={async () => {
        console.log('Signing Clicked');

        const { slug } = await createOrGetShareLink({
          token,
          documentId,
        });

        // TODO: Router delaying...
        return router.push(`/share/${slug}`);
      }}
    >
      <Share className="mr-2 h-5 w-5" />
      Share
    </Button>
  );
};
