import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { AppError } from '@documenso/lib/errors/app-error';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZRenameFolderFormSchema = z.object({
  name: z.string().min(1, { message: 'Folder name is required' }),
});

type TRenameFolderFormSchema = z.infer<typeof ZRenameFolderFormSchema>;

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
  const { _ } = useLingui();
  const { toast } = useToast();
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(isOpen || false);
  const [folderToRename, setFolderToRename] = useState<TFolderWithSubfolders | null>(
    folder || null,
  );

  const { mutateAsync: updateFolder } = trpc.folder.updateFolder.useMutation();

  const form = useForm<TRenameFolderFormSchema>({
    resolver: zodResolver(ZRenameFolderFormSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      setIsRenameFolderOpen(isOpen);
    }

    if (folder && isOpen) {
      setFolderToRename(folder);
      form.reset({ name: folder.name });
    }
  }, [isOpen, folder, form]);

  const handleOpenChange = (open: boolean) => {
    setIsRenameFolderOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  const onFormSubmit = async ({ name }: TRenameFolderFormSchema) => {
    if (!folderToRename) return;

    try {
      await updateFolder({
        id: folderToRename.id,
        name,
      });

      toast({
        title: _(msg`Folder renamed successfully`),
      });

      setFolderToRename(null);
      handleOpenChange(false);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.NOT_FOUND) {
        toast({
          title: _(msg`Folder not found`),
          description: _(msg`The folder you are trying to rename does not exist.`),
          variant: 'destructive',
        });

        return;
      }

      toast({
        title: _(msg`Failed to rename folder`),
        description: _(msg`An unknown error occurred while renaming the folder.`),
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Rename</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
