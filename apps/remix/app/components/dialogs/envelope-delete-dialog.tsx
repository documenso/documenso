import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, EnvelopeType } from '@prisma/client';
import { P, match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
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
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

type EnvelopeDeleteDialogProps = {
  id: string;
  type: EnvelopeType;
  trigger?: React.ReactNode;
  onDelete?: () => Promise<void> | void;
  status: DocumentStatus;
  title: string;
  canManageDocument: boolean;
};

export const EnvelopeDeleteDialog = ({
  id,
  type,
  trigger,
  onDelete,
  status,
  title,
  canManageDocument,
}: EnvelopeDeleteDialogProps) => {
  const { toast } = useToast();
  const { refreshLimits } = useLimits();
  const { t } = useLingui();

  const deleteMessage = msg`delete`;

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(status === DocumentStatus.DRAFT);

  const { mutateAsync: deleteEnvelope, isPending } = trpcReact.envelope.delete.useMutation({
    onSuccess: async () => {
      void refreshLimits();

      toast({
        title: t`Document deleted`,
        description: t`"${title}" has been successfully deleted`,
        duration: 5000,
      });

      await onDelete?.();

      setOpen(false);
    },
    onError: () => {
      toast({
        title: t`Something went wrong`,
        description: t`This document could not be deleted at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  useEffect(() => {
    if (open) {
      setInputValue('');
      setIsDeleteEnabled(status === DocumentStatus.DRAFT);
    }
  }, [open, status]);

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    setIsDeleteEnabled(event.target.value === t(deleteMessage));
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription>
            {canManageDocument ? (
              <Trans>
                You are about to delete <strong>"{title}"</strong>
              </Trans>
            ) : (
              <Trans>
                You are about to hide <strong>"{title}"</strong>
              </Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        {canManageDocument ? (
          <Alert variant="warning" className="-mt-1">
            {match(status)
              .with(DocumentStatus.DRAFT, () => (
                <AlertDescription>
                  {type === EnvelopeType.DOCUMENT ? (
                    <Trans>
                      Please note that this action is <strong>irreversible</strong>. Once confirmed,
                      this document will be permanently deleted.
                    </Trans>
                  ) : (
                    <Trans>
                      Please note that this action is <strong>irreversible</strong>. Once confirmed,
                      this template will be permanently deleted.
                    </Trans>
                  )}
                </AlertDescription>
              ))
              .with(DocumentStatus.PENDING, () => (
                <AlertDescription>
                  <p>
                    <Trans>
                      Please note that this action is <strong>irreversible</strong>.
                    </Trans>
                  </p>

                  <p className="mt-1">
                    <Trans>Once confirmed, the following will occur:</Trans>
                  </p>

                  <ul className="mt-0.5 list-inside list-disc">
                    <li>
                      <Trans>Document will be permanently deleted</Trans>
                    </li>
                    <li>
                      <Trans>Document signing process will be cancelled</Trans>
                    </li>
                    <li>
                      <Trans>All inserted signatures will be voided</Trans>
                    </li>
                    <li>
                      <Trans>All recipients will be notified</Trans>
                    </li>
                  </ul>
                </AlertDescription>
              ))
              .with(P.union(DocumentStatus.COMPLETED, DocumentStatus.REJECTED), () => (
                <AlertDescription>
                  <p>
                    <Trans>By deleting this document, the following will occur:</Trans>
                  </p>

                  <ul className="mt-0.5 list-inside list-disc">
                    <li>
                      <Trans>The document will be hidden from your account</Trans>
                    </li>
                    <li>
                      <Trans>Recipients will still retain their copy of the document</Trans>
                    </li>
                  </ul>
                </AlertDescription>
              ))
              .exhaustive()}
          </Alert>
        ) : (
          <Alert variant="warning" className="-mt-1">
            <AlertDescription>
              <Trans>Please contact support if you would like to revert this action.</Trans>
            </AlertDescription>
          </Alert>
        )}

        {status !== DocumentStatus.DRAFT && canManageDocument && (
          <Input
            type="text"
            value={inputValue}
            onChange={onInputChange}
            placeholder={t`Please type ${`'${t(deleteMessage)}'`} to confirm`}
          />
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isPending}>
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button
            type="button"
            loading={isPending}
            onClick={() => void deleteEnvelope({ envelopeId: id })}
            disabled={!isDeleteEnabled && canManageDocument}
            variant="destructive"
          >
            {canManageDocument ? <Trans>Delete</Trans> : <Trans>Hide</Trans>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
