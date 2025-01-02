import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Recipient } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import { useSearchParams } from 'react-router';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { formatSigningLink } from '@documenso/lib/utils/recipients';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentRecipientLinkCopyDialogProps = {
  trigger?: React.ReactNode;
  recipients: Recipient[];
};

export const DocumentRecipientLinkCopyDialog = ({
  trigger,
  recipients,
}: DocumentRecipientLinkCopyDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [, copy] = useCopyToClipboard();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const [open, setOpen] = useState(false);

  const actionSearchParam = searchParams?.get('action');

  const onBulkCopy = async () => {
    const generatedString = recipients
      .filter((recipient) => recipient.role !== RecipientRole.CC)
      .map((recipient) => `${recipient.email}\n${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`)
      .join('\n\n');

    await copy(generatedString).then(() => {
      toast({
        title: _(msg`Copied to clipboard`),
        description: _(msg`All signing links have been copied to your clipboard.`),
      });
    });
  };

  useEffect(() => {
    if (actionSearchParam === 'view-signing-links') {
      setOpen(true);
      updateSearchParams({ action: null });
    }
  }, [actionSearchParam, open]);

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle className="pb-0.5">
            <Trans>Copy Signing Links</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              You can copy and share these links to recipients so they can action the document.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <ul className="text-muted-foreground divide-y rounded-lg border">
          {recipients.length === 0 && (
            <li className="flex flex-col items-center justify-center py-6 text-sm">
              <Trans>No recipients</Trans>
            </li>
          )}

          {recipients.map((recipient) => (
            <li key={recipient.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <AvatarWithText
                avatarFallback={recipient.email.slice(0, 1).toUpperCase()}
                primaryText={<p className="text-muted-foreground text-sm">{recipient.email}</p>}
                secondaryText={
                  <p className="text-muted-foreground/70 text-xs">
                    {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                  </p>
                }
              />

              {recipient.role !== RecipientRole.CC && (
                <CopyTextButton
                  value={formatSigningLink(recipient.token)}
                  onCopySuccess={() => {
                    toast({
                      title: _(msg`Copied to clipboard`),
                      description: _(msg`The signing link has been copied to your clipboard.`),
                    });
                  }}
                  badgeContentUncopied={
                    <p className="ml-1 text-xs">
                      <Trans>Copy</Trans>
                    </p>
                  }
                  badgeContentCopied={
                    <p className="ml-1 text-xs">
                      <Trans>Copied</Trans>
                    </p>
                  }
                />
              )}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              <Trans>Close</Trans>
            </Button>
          </DialogClose>

          <Button type="button" onClick={onBulkCopy}>
            <Trans>Bulk Copy</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
