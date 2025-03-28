import type * as DialogPrimitive from '@radix-ui/react-dialog';

import { trpc } from '@documenso/trpc/react';
import type { TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
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

export type FolderDeleteDialogProps = {
  folder: TFolderWithSubfolders | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const FolderDeleteDialog = ({ folder, isOpen, onOpenChange }: FolderDeleteDialogProps) => {
  const { toast } = useToast();
  const { mutateAsync: deleteFolder } = trpc.folder.deleteFolder.useMutation();

  const handleDeleteFolder = async () => {
    if (!folder) return;

    try {
      await deleteFolder({
        id: folder.id,
      });

      onOpenChange(false);

      toast({
        title: 'Folder deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: 'Failed to delete folder',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this folder?
            {folder && folder._count.documents > 0 && (
              <span className="text-destructive mt-2 block">
                This folder contains {folder._count.documents} document(s). Deleting it will also
                delete all documents in the folder.
              </span>
            )}
            {folder && folder._count.subfolders > 0 && (
              <span className="text-destructive mt-2 block">
                This folder contains {folder._count.subfolders} subfolder(s). Deleting it will
                delete all subfolders and their contents.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteFolder}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
