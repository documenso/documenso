import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { FolderIcon, HomeIcon } from 'lucide-react';
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
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type FolderMoveDialogProps = {
  foldersData: TFolderWithSubfolders[] | undefined;
  folder: TFolderWithSubfolders | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZMoveFolderFormSchema = z.object({
  targetFolderId: z.string().nullable(),
});

type TMoveFolderFormSchema = z.infer<typeof ZMoveFolderFormSchema>;

export const FolderMoveDialog = ({
  foldersData,
  folder,
  isOpen,
  onOpenChange,
}: FolderMoveDialogProps) => {
  const { _ } = useLingui();

  const { toast } = useToast();
  const { mutateAsync: moveFolder } = trpc.folder.moveFolder.useMutation();

  const form = useForm<TMoveFolderFormSchema>({
    resolver: zodResolver(ZMoveFolderFormSchema),
    defaultValues: {
      targetFolderId: null,
    },
  });

  const onFormSubmit = async ({ targetFolderId }: TMoveFolderFormSchema) => {
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
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.NOT_FOUND) {
        toast({
          title: 'Folder not found',
          description: _(msg`The folder you are trying to move does not exist.`),
          variant: 'destructive',
        });

        return;
      }

      toast({
        title: 'Failed to move folder',
        description: _(msg`An unknown error occurred while moving the folder.`),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Folder</DialogTitle>
          <DialogDescription>Select a destination for this folder.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="targetFolderId"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant={field.value === null ? 'default' : 'outline'}
                        className="w-full justify-start"
                        disabled={folder?.parentId === null}
                        onClick={() => field.onChange(null)}
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
                              type="button"
                              disabled={f.id === folder?.parentId}
                              variant={field.value === f.id ? 'default' : 'outline'}
                              className="w-full justify-start"
                              onClick={() => field.onChange(f.id)}
                            >
                              <FolderIcon className="mr-2 h-4 w-4" />
                              {f.name}
                            </Button>
                          ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting ||
                  form.getValues('targetFolderId') === folder?.parentId
                }
              >
                Move Folder
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
