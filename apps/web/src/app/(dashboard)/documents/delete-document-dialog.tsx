import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { DocumentStatus } from '@documenso/prisma/client';
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
  status: DocumentStatus;
  documentTitle: string;
  teamId?: number;
};

export const DeleteDocumentDialog = ({
  id,
  open,
  onOpenChange,
  status,
  documentTitle,
  teamId,
}: DeleteDocumentDialogProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const [inputValue, setInputValue] = useState('');
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(status === DocumentStatus.DRAFT);

  const { mutateAsync: deleteDocument, isLoading } = trpcReact.document.deleteDocument.useMutation({
    onSuccess: () => {
      router.refresh();

      toast({
        title: 'Document deleted',
        description: `"${documentTitle}" has been successfully deleted`,
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
        title: 'Something went wrong',
        description: 'This document could not be deleted at this time. Please try again.',
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
          <DialogTitle>Are you sure you want to delete "{documentTitle}"?</DialogTitle>

          <DialogDescription>
            Please note that this action is irreversible. Once confirmed, your document will be
            permanently deleted.
          </DialogDescription>
        </DialogHeader>

        {status !== DocumentStatus.DRAFT && (
          <div className="mt-4">
            <Input
              type="text"
              value={inputValue}
              onChange={onInputChange}
              placeholder="Type 'delete' to confirm"
            />
          </div>
        )}

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

            <Button
              type="button"
              loading={isLoading}
              onClick={onDelete}
              disabled={!isDeleteEnabled}
              variant="destructive"
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
