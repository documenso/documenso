'use client';

import Link from 'next/link';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import type { Recipient } from '@documenso/prisma/client';
import { type Document, SigningStatus } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminActionsProps = {
  className?: string;
  document: Document;
  recipients: Recipient[];
};

export const AdminActions = ({ className, document, recipients }: AdminActionsProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutate: resealDocument, isLoading: isResealDocumentLoading } =
    trpc.admin.resealDocument.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`Document resealed`),
        });
      },
      onError: () => {
        toast({
          title: _(msg`Error`),
          description: _(msg`Failed to reseal document`),
          variant: 'destructive',
        });
      },
    });

  return (
    <div className={cn('flex gap-x-4', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              loading={isResealDocumentLoading}
              disabled={recipients.some(
                (recipient) => recipient.signingStatus !== SigningStatus.SIGNED,
              )}
              onClick={() => resealDocument({ id: document.id })}
            >
              <Trans>Reseal document</Trans>
            </Button>
          </TooltipTrigger>

          <TooltipContent className="max-w-[40ch]">
            <Trans>
              Attempts sealing the document again, useful for after a code change has occurred to
              resolve an erroneous document.
            </Trans>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="outline" asChild>
        <Link href={`/admin/users/${document.userId}`}>
          <Trans>Go to owner</Trans>
        </Link>
      </Button>
    </div>
  );
};
