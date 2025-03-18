import { useEffect, useState } from 'react';

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
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type FolderRenameDialogProps = {
  trigger?: React.ReactNode;
  folder?: TFolderWithSubfolders | null;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const FolderRenameDialog = ({
  trigger,
  folder,
  isOpen,
  onOpenChange,
  ...props
}: FolderRenameDialogProps) => {
  const { toast } = useToast();
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(isOpen || false);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [folderToRename, setFolderToRename] = useState<TFolderWithSubfolders | null>(
    folder || null,
  );

  const { mutateAsync: updateFolder } = trpc.folder.updateFolder.useMutation();

  useEffect(() => {
    if (isOpen !== undefined) {
      setIsRenameFolderOpen(isOpen);
    }

    if (folder && isOpen) {
      setFolderToRename(folder);
      setRenameFolderName(folder.name);
    }
  }, [isOpen, folder]);

  const handleOpenChange = (open: boolean) => {
    setIsRenameFolderOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  const handleRenameFolder = async () => {
    if (!folderToRename) return;

    if (!renameFolderName.trim()) {
      toast({
        title: 'Folder name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateFolder({
        id: folderToRename.id,
        name: renameFolderName,
      });

      toast({
        title: 'Folder renamed successfully',
      });

      setFolderToRename(null);
      setRenameFolderName('');
      handleOpenChange(false);
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast({
        title: 'Failed to rename folder',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog {...props} open={isRenameFolderOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Folder</DialogTitle>
          <DialogDescription>Enter a new name for your folder.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="rename-folder-name">Folder Name</Label>
          <Input
            id="rename-folder-name"
            value={renameFolderName}
            onChange={(e) => setRenameFolderName(e.target.value)}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRenameFolder}>Rename</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
