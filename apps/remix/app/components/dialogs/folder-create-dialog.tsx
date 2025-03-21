import { useMemo, useState } from 'react';

import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { FolderPlusIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

import { parseToIntegerArray } from '@documenso/lib/utils/params';
import { trpc } from '@documenso/trpc/react';
import { ZFindDocumentsInternalRequestSchema } from '@documenso/trpc/server/document-router/schema';
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

const ZSearchParamsSchema = ZFindDocumentsInternalRequestSchema.pick({
  status: true,
  period: true,
  page: true,
  perPage: true,
  query: true,
}).extend({
  senderIds: z.string().transform(parseToIntegerArray).optional().catch([]),
  folderId: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
});

export type CreateFolderDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const CreateFolderDialog = ({ trigger, ...props }: CreateFolderDialogProps) => {
  const { toast } = useToast();

  const [searchParams] = useSearchParams();

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const findDocumentSearchParams = useMemo(
    () => ZSearchParamsSchema.safeParse(Object.fromEntries(searchParams.entries())).data || {},
    [searchParams],
  );

  const currentFolderId = findDocumentSearchParams.folderId;

  const { mutateAsync: createFolder } = trpc.folder.createFolder.useMutation();

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: 'Folder name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createFolder({
        name: newFolderName,
        parentId: currentFolderId,
      });

      setNewFolderName('');
      setIsCreateFolderOpen(false);

      toast({
        title: 'Folder created successfully',
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Failed to create folder',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mt-4 flex justify-end">
      <Dialog {...props} open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" className="flex items-center space-x-2">
              <FolderPlusIcon className="h-4 w-4" />
              <span>Create Folder</span>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for your new folder. Folders help you organize your documents.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="My Folder"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
