import { useState } from 'react';

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
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

type DeleteDocumentDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DeleteDocumentDialog = ({ id, open, onOpenChange }: DeleteDocumentDialogProps) => {
  const [textValue, setTextValue] = useState('');
  const router = useRouter();

  const { toast } = useToast();

  const { mutateAsync: deleteDocument, isLoading } = trpcReact.document.deleteDocument.useMutation({
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

  const onDelete = async () => {
    try {
      if (textValue !== 'delete me') {
        toast({
          title: 'Something went wrong',
          description: 'Please enter delete me to confirm.',
          variant: 'destructive',
          duration: 4000,
        });
        return;
      }
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

  const onCancel = async () => {
    setTextValue('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Do you want to delete this document?</DialogTitle>

          <DialogDescription>
            Please note that this action is irreversible. You will not be able to recover this
            document.
          </DialogDescription>
        </DialogHeader>

        <p>
          Enter <span className=" font-semibold">delete me</span> to confirm
        </p>
        <Input type="text" onChange={(e) => setTextValue(e.target.value)} />

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
              Cancel
            </Button>

            <Button type="button" loading={isLoading} onClick={onDelete} className="flex-1">
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
