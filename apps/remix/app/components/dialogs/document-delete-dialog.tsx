import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import { P, match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

type DocumentDeleteDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onDelete?: () => Promise<void> | void;
  status: DocumentStatus;
  documentTitle: string;
  canManageDocument: boolean;
};

export const DocumentDeleteDialog = ({
  id,
  open,
  onOpenChange,
  onDelete,
  status,
  documentTitle,
  canManageDocument,
}: DocumentDeleteDialogProps) => {
  const { toast } = useToast();
  const { refreshLimits } = useLimits();
  const { _ } = useLingui();

  const deleteMessage = msg`delete`;

  const [inputValue, setInputValue] = useState('');
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(status === DocumentStatus.DRAFT);

  const { mutateAsync: deleteDocument, isPending } = trpcReact.document.deleteDocument.useMutation({
    onSuccess: async () => {
      void refreshLimits();

      toast({
        title: _(msg`Document deleted`),
        description: _(msg`"${documentTitle}" has been successfully deleted`),
        duration: 5000,
      });

      await onDelete?.();

      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`This document could not be deleted at this time. Please try again.`),
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
    setIsDeleteEnabled(event.target.value === _(deleteMessage));
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription>
            {canManageDocument ? (
              <Trans>
                You are about to delete <strong>"{documentTitle}"</strong>
              </Trans>
            ) : (
              <Trans>
                You are about to hide <strong>"{documentTitle}"</strong>
              </Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        {canManageDocument ? (
          <Alert variant="warning" className="-mt-1">
            {match(status)
              .with(DocumentStatus.DRAFT, () => (
                <AlertDescription>
                  <Trans>
                    Please note that this action is <strong>irreversible</strong>. Once confirmed,
                    this document will be permanently deleted.
                  </Trans>
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
            placeholder={_(msg`Please type ${`'${_(deleteMessage)}'`} to confirm`)}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="button"
            loading={isPending}
            onClick={() => void deleteDocument({ documentId: id })}
            disabled={!isDeleteEnabled && canManageDocument}
            variant="destructive"
          >
            {canManageDocument ? _(msg`Delete`) : _(msg`Hide`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
