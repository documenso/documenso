'use client';

import { HTMLAttributes } from 'react';

import { Copy, Share, Twitter } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';

export type ShareButtonProps = HTMLAttributes<HTMLButtonElement> & {
  token: string;
  documentId: number;
};

const generateTwitterIntent = (text: string, shareUrl: string) => {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}%0A${encodeURIComponent(
    shareUrl,
  )}`;
};

export const ShareButton = ({ token, documentId }: ShareButtonProps) => {
  const { toast } = useToast();
  const [, copyToClipboard] = useCopyToClipboard();

  const { mutateAsync: createOrGetShareLink, isLoading } =
    trpc.shareLink.createOrGetShareLink.useMutation();

  const onCopyClick = async () => {
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

  const onTweetClick = async () => {
    const { slug } = await createOrGetShareLink({
      token: token,
      documentId,
    });

    window.open(
      generateTwitterIntent(
        'I just signed a document with @documenso. Check it out!',
        `${window.location.origin}/share/${slug}`,
      ),
      '_blank',
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={!token || !documentId}
          className="flex-1"
          loading={isLoading}
        >
          {!isLoading && <Share className="mr-2 h-5 w-5" />}
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem className="px-10 py-3" asChild>
          <div className="border-0" onClick={onCopyClick}>
            <Copy className="mr-2 h-5 w-5" />
            Copy Link
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem className="px-10 py-3" asChild>
          <div onClick={onTweetClick}>
            <Twitter className="mr-2 h-5 w-5" />
            Tweet
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
