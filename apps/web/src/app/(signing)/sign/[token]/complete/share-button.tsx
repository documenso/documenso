'use client';

import { HTMLAttributes } from 'react';

import { Share } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';

export type ShareButtonProps = HTMLAttributes<HTMLButtonElement> & {
  token: string;
  documentId: number;
};

export const ShareButton = ({ token, documentId }: ShareButtonProps) => {
  const { toast } = useToast();
  const [, copyToClipboard] = useCopyToClipboard();

  const { mutateAsync: createOrGetShareLink, isLoading } =
    trpc.shareLink.createOrGetShareLink.useMutation();

  const onShareClick = async () => {
    const { slug } = await createOrGetShareLink({
      token: token,
      documentId,
    });

    await copyToClipboard(`${window.location.origin}/share/${slug}`).catch(() => null);

    toast({
      title: 'Copied to clipboard',
      description: 'The sharing link has been copied to your clipboard.',
    });
  };

  return (
    <Button
      variant="outline"
      className="flex-1"
      disabled={!token || !documentId}
      loading={isLoading}
      onClick={onShareClick}
    >
      {!isLoading && <Share className="mr-2 h-5 w-5" />}
      Share
    </Button>
  );
};
