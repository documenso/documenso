import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { DocumentStatus } from '@documenso/prisma/client';
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

type DeleteDocumentDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  status: DocumentStatus;
  documentTitle: string;
  teamId?: number;
  canManageDocument: boolean;
};

export const DeleteDocumentDialog = ({
  id,
  open,
  onOpenChange,
  status,
  documentTitle,
  teamId,
  canManageDocument,
}: DeleteDocumentDialogProps) => {
  const router = useRouter();

  const { toast } = useToast();
  const { refreshLimits } = useLimits();
  const { _ } = useLingui();

  const [inputValue, setInputValue] = useState('');
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(status === DocumentStatus.DRAFT);

  const { mutateAsync: deleteDocument, isLoading } = trpcReact.document.deleteDocument.useMutation({
    onSuccess: () => {
      router.refresh();
      void refreshLimits();

      toast({
        title: _(msg`Document deleted`),
        description: _(msg`"${documentTitle}" has been successfully deleted`),
        duration: 5000,
      });

      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      setInputValue('');
      setIsDeleteEnabled(status === DocumentStatus.DRAFT);
    }
  }, [open, status]);

  const onDelete = async () => {
    try {
      await deleteDocument({ id, teamId });
    } catch {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`This document could not be deleted at this time. Please try again.`),
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    setIsDeleteEnabled(event.target.value === 'delete');
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
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
              .with(DocumentStatus.COMPLETED, () => (
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
            placeholder={_(msg`Type 'delete' to confirm`)}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="button"
            loading={isLoading}
            onClick={onDelete}
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
