'use client';

import type { HTMLAttributes } from 'react';
import React, { useState } from 'react';

import { Copy, Sparkles } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

import { useCopyShareLink } from '@documenso/lib/client-only/hooks/use-copy-share-link';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  TOAST_DOCUMENT_SHARE_ERROR,
  TOAST_DOCUMENT_SHARE_SUCCESS,
} from '@documenso/lib/constants/toast';
import { generateTwitterIntent } from '@documenso/lib/universal/generate-twitter-intent';
import { trpc } from '@documenso/trpc/react';

import { cn } from '../../lib/utils';
import { Button } from '../../primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../primitives/dialog';
import { useToast } from '../../primitives/use-toast';

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
    isLoading: isCreatingOrGettingShareLink,
  } = trpc.shareLink.createOrGetShareLink.useMutation();

  const isLoading = isCreatingOrGettingShareLink || isCopyingShareLink;

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
      await copyShareLink(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${shareLink.slug}`);
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
    await fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}/opengraph`, {
      // We don't care about the response, so we can use no-cors
      mode: 'no-cors',
    });

    window.open(
      generateTwitterIntent(
        `I just ${token ? 'signed' : 'sent'} a document in style with @documenso. Check it out!`,
        `${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}`,
      ),
      '_blank',
    );

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger?.({
          disabled: !documentId,
          loading: isLoading,
        }) || (
          <Button
            variant="outline"
            disabled={!token || !documentId}
            className={cn('flex-1 text-[11px]', className)}
            loading={isLoading}
          >
            {!isLoading && <Sparkles className="mr-2 h-5 w-5" />}
            Share Signature Card
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="end">
        <DialogHeader>
          <DialogTitle>Share your signing experience!</DialogTitle>

          <DialogDescription className="mt-4">
            Don't worry, the document you signed or sent wont be shared; only your signing
            experience is. Share your signing card and showcase your signature!
          </DialogDescription>
        </DialogHeader>

        <div className="flex w-full flex-col">
          <div className="rounded-md border p-4">
            I just {token ? 'signed' : 'sent'} a document in style with{' '}
            <span className="font-medium text-blue-400">@documenso</span>
            . Check it out!
            <span className="mt-2 block" />
            <span
              className={cn('break-all font-medium text-blue-400', {
                'animate-pulse': !shareLink?.slug,
              })}
            >
              {NEXT_PUBLIC_WEBAPP_URL()}/share/{shareLink?.slug || '...'}
            </span>
            <div
              className={cn(
                'bg-muted/40 mt-4 aspect-[1200/630] overflow-hidden rounded-lg border',
                {
                  'animate-pulse': !shareLink?.slug,
                },
              )}
            >
              {shareLink?.slug && (
                <img
                  src={`${NEXT_PUBLIC_WEBAPP_URL()}/share/${shareLink.slug}/opengraph`}
                  alt="sharing link"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <Button variant="outline" className="flex-1" onClick={onTweetClick}>
              <FaXTwitter className="mr-2 h-4 w-4" />
              Tweet
            </Button>

            <Button variant="outline" className="flex-1" onClick={onCopyClick}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
