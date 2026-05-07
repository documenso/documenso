import type { HTMLAttributes } from 'react';
import React, { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Copy, Sparkles } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

import { useCopyShareLink } from '@documenso/lib/client-only/hooks/use-copy-share-link';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
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
  envelopeId: string;
  trigger?: (_props: { loading: boolean; disabled: boolean }) => React.ReactNode;
};

export const DocumentShareButton = ({
  token,
  envelopeId,
  className,
  trigger,
}: DocumentShareButtonProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { sessionData } = useOptionalSession();
  const isLoggedIn = Boolean(sessionData?.user);

  const { copyShareLink, createAndCopyShareLink, isCopyingShareLink } = useCopyShareLink({
    onSuccess: () =>
      toast({
        title: _(msg`Copied to clipboard`),
        description: _(msg`The sharing link has been copied to your clipboard.`),
      }),
    onError: () =>
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`The sharing link could not be created at this time. Please try again.`),
        variant: 'destructive',
        duration: 5000,
      }),
  });

  const [isOpen, setIsOpen] = useState(false);

  const { data: qrData, isFetching: isFetchingQrCode } = trpc.envelope.getQrCode.useQuery(
    { envelopeId },
    {
      enabled: isLoggedIn && Boolean(envelopeId) && isOpen,
    },
  );

  const {
    mutateAsync: createOrGetShareLink,
    data: shareLink,
    isPending: isCreatingOrGettingShareLink,
  } = trpc.document.share.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  });

  const displaySlug = qrData?.shareToken ?? null ?? shareLink?.slug;
  const previewUrl =
    qrData?.qrCodeUrl ?? (displaySlug ? `${NEXT_PUBLIC_WEBAPP_URL()}/share/${displaySlug}` : null);

  const isLoading = isCreatingOrGettingShareLink || isCopyingShareLink || isFetchingQrCode;

  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      void createOrGetShareLink({
        token,
        envelopeId,
      });
    }

    setIsOpen(nextOpen);
  };

  const onCopyClick = async () => {
    if (displaySlug) {
      await copyShareLink(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${displaySlug}`);
    } else {
      await createAndCopyShareLink({
        token,
        envelopeId,
      });
    }

    setIsOpen(false);
  };

  const onTweetClick = async () => {
    let slug = displaySlug ?? '';

    if (!slug) {
      const result = await createOrGetShareLink({
        token,
        envelopeId,
      });

      slug = result.slug;
    }

    const url = `${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}`;

    // Ensuring we've prewarmed the opengraph image for the Twitter
    await fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}/opengraph`, {
      // We don't care about the response, so we can use no-cors
      mode: 'no-cors',
    });

    window.open(
      generateTwitterIntent(
        `I just ${token ? 'signed' : 'sent'} a document in style with @documenso. Check it out!`,
        url,
      ),
      '_blank',
    );

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger?.({
          disabled: !envelopeId,
          loading: isLoading,
        }) || (
          <Button
            variant="outline"
            disabled={!envelopeId}
            className={cn('h-11 w-full max-w-lg flex-1', className)}
            loading={isLoading}
          >
            {!isLoading && <Sparkles className="mr-2 h-5 w-5" />}
            <Trans>Share</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="end">
        <DialogHeader>
          <DialogTitle className="w-full max-w-full whitespace-pre-line break-words">
            <Trans>Share your signing experience!</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              Rest assured, your document is strictly confidential and will never be shared. Only
              your signing experience will be highlighted. Share your personalized signing card to
              showcase your signature!
            </Trans>
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
                'animate-pulse': !displaySlug,
              })}
            >
              {previewUrl ?? '...'}
            </span>
            <div
              className={cn(
                'mt-4 aspect-[1200/630] overflow-hidden rounded-lg border bg-muted/40',
                {
                  'animate-pulse': !displaySlug,
                },
              )}
            >
              {displaySlug && (
                <img
                  src={`${NEXT_PUBLIC_WEBAPP_URL()}/share/${displaySlug}/opengraph`}
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
              <Trans>Copy Link</Trans>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
