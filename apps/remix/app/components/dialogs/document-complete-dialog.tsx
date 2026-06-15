import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { CheckCircle2 } from 'lucide-react';
import { useRevalidator } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import type { TRecipientLite } from '@documenso/lib/types/recipient';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { DropdownMenuItem } from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentCompleteDialogProps = {
  documentId: number;
  status: DocumentStatus;
  recipients: TRecipientLite[];
  canManageDocument: boolean;
};

export const DocumentCompleteDialog = ({
  documentId,
  status,
  recipients,
  canManageDocument,
}: DocumentCompleteDialogProps) => {
  const { user } = useSession();

  const { toast } = useToast();
  const { _ } = useLingui();
  const { revalidate } = useRevalidator();

  const [isOpen, setIsOpen] = useState(false);

  const trpcUtils = trpcReact.useUtils();

  // Recipients (excluding CCs, who never sign) that still have not signed.
  const pendingRecipients = recipients.filter(
    (recipient) =>
      recipient.role !== RecipientRole.CC &&
      recipient.signingStatus !== SigningStatus.SIGNED &&
      recipient.signingStatus !== SigningStatus.REJECTED,
  );

  const hasRejection = recipients.some(
    (recipient) => recipient.signingStatus === SigningStatus.REJECTED,
  );

  // Only show/enable the action when finalizing early actually makes sense: an
  // owner/manager, a pending document with outstanding signatures, and no
  // rejection (a rejected document follows the rejection flow instead).
  const isDisabled =
    !canManageDocument ||
    status !== DocumentStatus.PENDING ||
    hasRejection ||
    pendingRecipients.length === 0;

  const { mutateAsync: completeDocument, isPending } = trpcReact.document.complete.useMutation({
    onSuccess: async () => {
      toast({
        title: _(msg`Document finalized`),
        description: _(
          msg`The document has been sealed with the signatures captured so far.`,
        ),
        duration: 5000,
      });

      await trpcUtils.envelope.get.invalidate();
      await revalidate();

      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`This document could not be finalized at this time. Please try again.`),
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem disabled={isDisabled} onSelect={(e) => e.preventDefault()}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          <Trans>Complete now</Trans>
        </DropdownMenuItem>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Complete document without all signatures?</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              This will finalize and seal the document with the signatures captured so far. The
              following recipients have not signed and will no longer be able to:
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <ul className="text-muted-foreground list-disc space-y-1 pl-6 text-sm">
          {pendingRecipients.map((recipient) => (
            <li key={recipient.id}>{recipient.name ? `${recipient.name} (${recipient.email})` : recipient.email}</li>
          ))}
        </ul>

        <p className="text-muted-foreground text-sm">
          <Trans>This action cannot be undone and is recorded in the document audit log.</Trans>
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isPending}>
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button
            type="button"
            loading={isPending}
            disabled={isDisabled || isPending}
            onClick={() => void completeDocument({ documentId })}
          >
            <Trans>Complete document</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
