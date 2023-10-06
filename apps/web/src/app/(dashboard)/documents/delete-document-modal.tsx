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

interface DeleteDocumentModalProps {
  id: number;
}

export const DeleteDocumentModal = ({ id }: DeleteDocumentModalProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const { mutateAsync: deleteDocument } = trpcReact.document.deleteDocument.useMutation({
    onSuccess: () => {
      onClose();
      toast({ title: 'Document deleted successfully' });
      router.refresh();
    },
  });

  const onClose = () => {
    router.back();
  };

  const onDraftDelete = async () => {
    await deleteDocument({ id });
  };
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Do you want to delete this document?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your document from our
            servers.
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
