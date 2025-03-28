import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
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

export type FolderDeleteDialogProps = {
  folder: TFolderWithSubfolders | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const FolderDeleteDialog = ({ folder, isOpen, onOpenChange }: FolderDeleteDialogProps) => {
  const { _ } = useLingui();

  const { toast } = useToast();
  const { mutateAsync: deleteFolder } = trpc.folder.deleteFolder.useMutation();

  const deleteMessage = _(msg`delete ${folder?.name ?? 'folder'}`);

  const ZDeleteFolderFormSchema = z.object({
    confirmText: z.literal(deleteMessage, {
      errorMap: () => ({ message: _(msg`You must type '${deleteMessage}' to confirm`) }),
    }),
  });

  type TDeleteFolderFormSchema = z.infer<typeof ZDeleteFolderFormSchema>;

  const form = useForm<TDeleteFolderFormSchema>({
    resolver: zodResolver(ZDeleteFolderFormSchema),
    defaultValues: {
      confirmText: '',
    },
  });

  const onFormSubmit = async () => {
    if (!folder) return;

    try {
      await deleteFolder({
        id: folder.id,
      });

      onOpenChange(false);

      toast({
        title: 'Folder deleted successfully',
      });
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.NOT_FOUND) {
        toast({
          title: 'Folder not found',
          description: _(msg`The folder you are trying to delete does not exist.`),
          variant: 'destructive',
        });

        return;
      }

      toast({
        title: 'Failed to delete folder',
        description: _(msg`An unknown error occurred while deleting the folder.`),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      form.reset();
    }
  }, [isOpen]);

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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="confirmText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>
                      Confirm by typing:{' '}
                      <span className="font-sm text-destructive font-semibold">
                        {deleteMessage}
                      </span>
                    </Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={deleteMessage} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="destructive" type="submit" disabled={!form.formState.isValid}>
                Delete
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
