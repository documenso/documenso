import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';

import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@documenso/ui/primitives/alert-dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentsBulkDeleteDialogProps = {
  documentIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const DocumentsBulkDeleteDialog = ({
  documentIds,
  open,
  onOpenChange,
  onSuccess,
  ...props
}: DocumentsBulkDeleteDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: bulkDeleteDocuments, isPending } = trpc.document.bulkDelete.useMutation();

  const trpcUtils = trpc.useUtils();

  const onDelete = async () => {
    try {
      const result = await bulkDeleteDocuments({
        documentIds,
      });

      await trpcUtils.document.findDocumentsInternal.invalidate();

      if (result.failedIds.length > 0) {
        toast({
          title: _(msg`Documents partially deleted`),
          description: _(
            msg`${result.deletedCount} document(s) deleted. ${result.failedIds.length} document(s) could not be deleted.`,
          ),
          variant: 'destructive',
        });
      } else {
        toast({
          title: _(msg`Documents deleted`),
          description: _(msg`${result.deletedCount} document(s) have been deleted.`),
          variant: 'default',
        });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch {
      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while deleting the documents.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <AlertDialog {...props} open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>Delete Documents</Trans>
          </AlertDialogTitle>

          <AlertDialogDescription>
            <Trans>You are about to delete {documentIds.length} document(s).</Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="warning">
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
                <Trans>Selected documents will be permanently deleted</Trans>
              </li>
              <li>
                <Trans>Pending documents will have their signing process cancelled</Trans>
              </li>
              <li>
                <Trans>All recipients will be notified</Trans>
              </li>
            </ul>
          </AlertDescription>
        </Alert>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onDelete();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? <Trans>Deleting...</Trans> : <Trans>Delete</Trans>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
