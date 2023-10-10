import { useRouter } from 'next/navigation';

import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

type DeleteDraftDocumentDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DeleteDraftDocumentDialog = ({
  id,
  open,
  onOpenChange,
}: DeleteDraftDocumentDialogProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const { mutateAsync: deleteDocument, isLoading } =
    trpcReact.document.deleteDraftDocument.useMutation({
      onSuccess: () => {
        router.refresh();

        toast({
          title: 'Document deleted',
          description: 'Your document has been successfully deleted.',
          duration: 5000,
        });

        onOpenChange(false);
      },
    });

  const onDraftDelete = async () => {
    try {
      await deleteDocument({ id });
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'This document could not be deleted at this time. Please try again.',
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Do you want to delete this document?</DialogTitle>

          <DialogDescription>
            Please note that this action is irreversible. Once confirmed, your document will be
            permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>

            <Button type="button" loading={isLoading} onClick={onDraftDelete} className="flex-1">
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
