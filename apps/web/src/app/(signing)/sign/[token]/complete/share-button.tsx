'use client';

import { HTMLAttributes, useState } from 'react';

import { Copy, Share, Twitter } from 'lucide-react';

import { generateTwitterIntent } from '@documenso/lib/universal/generate-twitter-intent';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';

export type ShareButtonProps = HTMLAttributes<HTMLButtonElement> & {
  token: string;
  documentId: number;
};

export const ShareButton = ({ token, documentId }: ShareButtonProps) => {
  const { toast } = useToast();
  const [, copyToClipboard] = useCopyToClipboard();

  const [isOpen, setIsOpen] = useState(false);

  const {
    mutateAsync: createOrGetShareLink,
    data: shareLink,
    isLoading,
  } = trpc.shareLink.createOrGetShareLink.useMutation();

  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      void createOrGetShareLink({
        token,
        documentId,
      });
    }

    setIsOpen(nextOpen);
  };

  const onCopyClick = async () => {
    let { slug = '' } = shareLink || {};

    if (!slug) {
      const result = await createOrGetShareLink({
        token,
        documentId,
      });

      slug = result.slug;
    }

    await copyToClipboard(`${window.location.origin}/share/${slug}`).catch(() => null);

    toast({
      title: 'Copied to clipboard',
      description: 'The sharing link has been copied to your clipboard.',
    });

    setIsOpen(false);
  };

  const onTweetClick = async () => {
    let { slug = '' } = shareLink || {};

    if (!slug) {
      const result = await createOrGetShareLink({
        token,
        documentId,
      });

      slug = result.slug;
    }

    window.open(
      generateTwitterIntent(
        `I just ${token ? 'signed' : 'sent'} a document with @documenso. Check it out!`,
        `${window.location.origin}/share/${slug}`,
      ),
      '_blank',
    );

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={!token || !documentId}
          className="flex-1"
          loading={isLoading}
        >
          {!isLoading && <Share className="mr-2 h-5 w-5" />}
          Share
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>

          <DialogDescription className="mt-4">Share your signing experience!</DialogDescription>
        </DialogHeader>

        <div className="flex w-full flex-col">
          <div className="rounded-md border p-4">
            I just signed a document with{' '}
            <span className="font-medium text-blue-400">@documenso</span>
            . Check it out!
            <span className="mt-2 block" />
            <span className="font-medium text-blue-400">
              {window.location.origin}/share/{shareLink?.slug || '...'}
            </span>
          </div>

          <Button variant="outline" className="mt-4" onClick={onTweetClick}>
            <Twitter className="mr-2 h-4 w-4" />
            Tweet
          </Button>

          <div className="relative flex items-center justify-center gap-x-4 py-4 text-xs uppercase">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground bg-transparent">Or</span>
            <div className="bg-border h-px flex-1" />
          </div>

          <Button variant="outline" onClick={onCopyClick}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
