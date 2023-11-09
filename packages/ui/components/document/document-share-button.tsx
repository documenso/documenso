'use client';

import React, { HTMLAttributes, useState } from 'react';

import { Copy, Share } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

import { useCopyShareLink } from '@documenso/lib/client-only/hooks/use-copy-share-link';
import {
  TOAST_DOCUMENT_SHARE_ERROR,
  TOAST_DOCUMENT_SHARE_SUCCESS,
} from '@documenso/lib/constants/toast';
import { generateTwitterIntent } from '@documenso/lib/universal/generate-twitter-intent';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
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

export type DocumentShareButtonProps = HTMLAttributes<HTMLButtonElement> & {
  token?: string;
  documentId: number;
  trigger?: (_props: { loading: boolean; disabled: boolean }) => React.ReactNode;
};

export const DocumentShareButton = ({
  token,
  documentId,
  className,
  trigger,
}: DocumentShareButtonProps) => {
  const { toast } = useToast();

  const { copyShareLink, createAndCopyShareLink, isCopyingShareLink } = useCopyShareLink({
    onSuccess: () => toast(TOAST_DOCUMENT_SHARE_SUCCESS),
    onError: () => toast(TOAST_DOCUMENT_SHARE_ERROR),
  });

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
    if (shareLink) {
      await copyShareLink(`${process.env.NEXT_PUBLIC_WEBAPP_URL}/share/${shareLink.slug}`);
    } else {
      await createAndCopyShareLink({
        token,
        documentId,
      });
    }

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

    // Ensuring we've prewarmed the opengraph image for the Twitter
    await fetch(`${process.env.NEXT_PUBLIC_WEBAPP_URL}/share/${slug}/opengraph`, {
      // We don't care about the response, so we can use no-cors
      mode: 'no-cors',
    });

    window.open(
      generateTwitterIntent(
        `I just ${token ? 'signed' : 'sent'} a document with @documenso. Check it out!`,
        `${process.env.NEXT_PUBLIC_WEBAPP_URL}/share/${slug}`,
      ),
      '_blank',
    );

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger?.({
          disabled: !token || !documentId,
          loading: isLoading || isCopyingShareLink,
        }) || (
          <Button
            variant="outline"
            disabled={!token || !documentId}
            className={cn('flex-1', className)}
            loading={isLoading || isCopyingShareLink}
          >
            {!isLoading && !isCopyingShareLink && <Share className="mr-2 h-5 w-5" />}
            Share
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="end">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>

          <DialogDescription className="mt-4">Share your signing experience!</DialogDescription>
        </DialogHeader>

        <div className="flex w-full flex-col">
          <div className="rounded-md border p-4">
            I just {token ? 'signed' : 'sent'} a document with{' '}
            <span className="font-medium text-blue-400">@documenso</span>
            . Check it out!
            <span className="mt-2 block" />
            <span
              className={cn('break-all font-medium text-blue-400', {
                'animate-pulse': !shareLink?.slug,
              })}
            >
              {process.env.NEXT_PUBLIC_WEBAPP_URL}/share/{shareLink?.slug || '...'}
            </span>
            <div
              className={cn('bg-muted/40 mt-4 aspect-video overflow-hidden rounded-lg border', {
                'animate-pulse': !shareLink?.slug,
              })}
            >
              {shareLink?.slug && (
                <img
                  src={`${process.env.NEXT_PUBLIC_WEBAPP_URL}/share/${shareLink.slug}/opengraph`}
                  alt="sharing link"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>

          <Button variant="outline" className="mt-4" onClick={onTweetClick}>
            <FaXTwitter className="mr-2 h-4 w-4" />
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
