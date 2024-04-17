'use client';

<<<<<<< HEAD
import { HTMLAttributes, useState } from 'react';

import { Copy, Share } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

import { useCopyShareLink } from '@documenso/lib/client-only/hooks/use-copy-share-link';
=======
import type { HTMLAttributes } from 'react';
import React, { useState } from 'react';

import { Copy, Sparkles } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

import { useCopyShareLink } from '@documenso/lib/client-only/hooks/use-copy-share-link';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
>>>>>>> main
import {
  TOAST_DOCUMENT_SHARE_ERROR,
  TOAST_DOCUMENT_SHARE_SUCCESS,
} from '@documenso/lib/constants/toast';
import { generateTwitterIntent } from '@documenso/lib/universal/generate-twitter-intent';
import { trpc } from '@documenso/trpc/react';
<<<<<<< HEAD
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
=======

import { cn } from '../../lib/utils';
import { Button } from '../../primitives/button';
>>>>>>> main
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
<<<<<<< HEAD
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentShareButtonProps = HTMLAttributes<HTMLButtonElement> & {
  token: string;
  documentId: number;
};

export const DocumentShareButton = ({ token, documentId, className }: DocumentShareButtonProps) => {
=======
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
>>>>>>> main
  const { toast } = useToast();

  const { copyShareLink, createAndCopyShareLink, isCopyingShareLink } = useCopyShareLink({
    onSuccess: () => toast(TOAST_DOCUMENT_SHARE_SUCCESS),
    onError: () => toast(TOAST_DOCUMENT_SHARE_ERROR),
  });

  const [isOpen, setIsOpen] = useState(false);

  const {
    mutateAsync: createOrGetShareLink,
    data: shareLink,
<<<<<<< HEAD
    isLoading,
  } = trpc.shareLink.createOrGetShareLink.useMutation();

=======
    isLoading: isCreatingOrGettingShareLink,
  } = trpc.shareLink.createOrGetShareLink.useMutation();

  const isLoading = isCreatingOrGettingShareLink || isCopyingShareLink;

>>>>>>> main
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
<<<<<<< HEAD
      await copyShareLink(`${window.location.origin}/share/${shareLink.slug}`);
=======
      await copyShareLink(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${shareLink.slug}`);
>>>>>>> main
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

<<<<<<< HEAD
    window.open(
      generateTwitterIntent(
        `I just ${token ? 'signed' : 'sent'} a document with @documenso. Check it out!`,
        `${process.env.NEXT_PUBLIC_WEBAPP_URL}/share/${slug}`,
=======
    // Ensuring we've prewarmed the opengraph image for the Twitter
    await fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}/opengraph`, {
      // We don't care about the response, so we can use no-cors
      mode: 'no-cors',
    });

    window.open(
      generateTwitterIntent(
        `I just ${token ? 'signed' : 'sent'} a document in style with @documenso. Check it out!`,
        `${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}`,
>>>>>>> main
      ),
      '_blank',
    );

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
<<<<<<< HEAD
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={!token || !documentId}
          className={cn('flex-1', className)}
          loading={isLoading || isCopyingShareLink}
        >
          {!isLoading && !isCopyingShareLink && <Share className="mr-2 h-5 w-5" />}
          Share
        </Button>
=======
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
>>>>>>> main
      </DialogTrigger>

      <DialogContent position="end">
        <DialogHeader>
<<<<<<< HEAD
          <DialogTitle>Share</DialogTitle>

          <DialogDescription className="mt-4">Share your signing experience!</DialogDescription>
=======
          <DialogTitle>Share your signing experience!</DialogTitle>

          <DialogDescription className="mt-4">
            Don't worry, the document you signed or sent wont be shared; only your signing
            experience is. Share your signing card and showcase your signature!
          </DialogDescription>
>>>>>>> main
        </DialogHeader>

        <div className="flex w-full flex-col">
          <div className="rounded-md border p-4">
<<<<<<< HEAD
            I just {token ? 'signed' : 'sent'} a document with{' '}
=======
            I just {token ? 'signed' : 'sent'} a document in style with{' '}
>>>>>>> main
            <span className="font-medium text-blue-400">@documenso</span>
            . Check it out!
            <span className="mt-2 block" />
            <span
              className={cn('break-all font-medium text-blue-400', {
                'animate-pulse': !shareLink?.slug,
              })}
            >
<<<<<<< HEAD
              {process.env.NEXT_PUBLIC_WEBAPP_URL}/share/{shareLink?.slug || '...'}
            </span>
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
=======
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
>>>>>>> main
        </div>
      </DialogContent>
    </Dialog>
  );
};
