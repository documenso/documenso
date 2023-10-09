'use client';

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
};

export const DeleteDraftDocumentDialog = ({ id, open }: DeleteDraftDocumentDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();

  const { mutateAsync: deleteDocument } = trpcReact.document.deleteDraftDocument.useMutation({
    onSuccess: () => {
      onClose();
      toast({ title: 'Document deleted successfully' });
      router.refresh();
    },
  });

  const onClose = () => {
    router.push('/documents');
  };

  const onDraftDelete = async () => {
    console.log({ id });

    await deleteDocument({ id });
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Do you want to delete this document?</DialogTitle>
          <DialogDescription>
            Please note that this action is irreversible. Once confirmed, your document will be
            permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <div className="flex w-full items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} size="sm">
              Cancel
            </Button>

            <Button onClick={onDraftDelete} size="sm" type="button">
              Continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
