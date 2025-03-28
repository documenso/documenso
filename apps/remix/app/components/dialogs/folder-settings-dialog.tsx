import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { DocumentVisibility } from '@documenso/lib/types/document-visibility';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type FolderSettingsDialogProps = {
  folder: TFolderWithSubfolders | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const ZUpdateFolderFormSchema = z.object({
  name: z.string().min(1),
  visibility: z.nativeEnum(DocumentVisibility),
});

export type TUpdateFolderFormSchema = z.infer<typeof ZUpdateFolderFormSchema>;

export const FolderSettingsDialog = ({
  folder,
  isOpen,
  onOpenChange,
}: FolderSettingsDialogProps) => {
  const { _ } = useLingui();

  const { toast } = useToast();
  const { mutateAsync: updateFolder } = trpc.folder.updateFolder.useMutation();

  const form = useForm<z.infer<typeof ZUpdateFolderFormSchema>>({
    resolver: zodResolver(ZUpdateFolderFormSchema),
    defaultValues: {
      name: folder?.name ?? '',
      visibility: folder?.visibility ?? DocumentVisibility.EVERYONE,
    },
  });

  useEffect(() => {
    if (folder) {
      form.reset({
        name: folder.name,
        visibility: folder.visibility ?? DocumentVisibility.EVERYONE,
      });
    }
  }, [folder, form]);

  const onFormSubmit = async (data: TUpdateFolderFormSchema) => {
    if (!folder) return;

    try {
      await updateFolder({
        id: folder.id,
        name: data.name,
        visibility: data.visibility,
      });

      toast({
        title: _(msg`Folder updated successfully`),
      });

      onOpenChange(false);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.NOT_FOUND) {
        toast({
          title: _(msg`Folder not found`),
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Folder Settings</DialogTitle>
          <DialogDescription>Manage the settings for this folder.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={DocumentVisibility.EVERYONE}>Everyone</SelectItem>
                      <SelectItem value={DocumentVisibility.MANAGER_AND_ABOVE}>
                        Managers and above
                      </SelectItem>
                      <SelectItem value={DocumentVisibility.ADMIN}>Admins only</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
