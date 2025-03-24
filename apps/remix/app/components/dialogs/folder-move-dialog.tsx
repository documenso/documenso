import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { FolderIcon, HomeIcon } from 'lucide-react';

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

export type FolderMoveDialogProps = {
  foldersData: TFolderWithSubfolders[] | undefined;
  folder: TFolderWithSubfolders | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const FolderMoveDialog = ({
  foldersData,
  folder,
  isOpen,
  onOpenChange,
}: FolderMoveDialogProps) => {
  const { toast } = useToast();

  const { mutateAsync: moveFolder } = trpc.folder.moveFolder.useMutation();

  const handleMoveFolder = async (targetFolderId: string | null) => {
    if (!folder) return;

    try {
      await moveFolder({
        id: folder.id,
        parentId: targetFolderId,
      });

      onOpenChange(false);

      toast({
        title: 'Folder moved successfully',
      });
    } catch (error) {
      console.error('Error moving folder:', error);
      toast({
        title: 'Failed to move folder',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Folder</DialogTitle>
          <DialogDescription>Select a destination for this folder.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={async () => await handleMoveFolder(null)}
          >
            <HomeIcon className="mr-2 h-4 w-4" />
            Root
          </Button>

          {foldersData &&
            foldersData
              .filter((f) => f.id !== folder?.id)
              .map((f) => (
                <Button
                  key={f.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={async () => await handleMoveFolder(f.id)}
                >
                  <FolderIcon className="mr-2 h-4 w-4" />
                  {f.name}
                </Button>
              ))}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
