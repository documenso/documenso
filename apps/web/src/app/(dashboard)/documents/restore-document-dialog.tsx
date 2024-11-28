import { useRouter } from 'next/navigation';

import type { DocumentStatus } from '@documenso/prisma/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@documenso/ui/primitives/alert-dialog';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

type RestoreDocumentDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  status: DocumentStatus;
  documentTitle: string;
  teamId?: number;
  canManageDocument: boolean;
};

export function RestoreDocumentDialog({
  id,
  teamId,
  open,
  onOpenChange,
  documentTitle,
  canManageDocument,
}: RestoreDocumentDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const { mutateAsync: restoreDocument, isLoading } =
    trpcReact.document.restoreDocument.useMutation({
      onSuccess: () => {
        router.refresh();

        toast({
          title: 'Document restored',
          description: `"${documentTitle}" has been successfully restored`,
          duration: 5000,
        });

        onOpenChange(false);
      },
    });

  const onRestore = async () => {
    try {
      await restoreDocument({ id, teamId });
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'This document could not be restored at this time. Please try again.',
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to restore the document <strong>"{documentTitle}"</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>

          <Button
            type="button"
            loading={isLoading}
            onClick={onRestore}
            disabled={!canManageDocument}
          >
            Restore
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
