import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
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
  DialogClose,
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

import { useOptionalCurrentTeam } from '~/providers/team';

export type FolderUpdateDialogProps = {
  folder: TFolderWithSubfolders | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const ZUpdateFolderFormSchema = z.object({
  name: z.string().min(1),
  visibility: z.nativeEnum(DocumentVisibility).optional(),
});

export type TUpdateFolderFormSchema = z.infer<typeof ZUpdateFolderFormSchema>;

export const FolderUpdateDialog = ({ folder, isOpen, onOpenChange }: FolderUpdateDialogProps) => {
  const { t } = useLingui();
  const team = useOptionalCurrentTeam();

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
    if (!folder) {
      return;
    }

    try {
      await updateFolder({
        folderId: folder.id,
        data: {
          name: data.name,
          visibility: data.visibility,
        },
      });

      toast({
        title: t`Folder updated successfully`,
      });

      onOpenChange(false);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.NOT_FOUND) {
        toast({
          title: t`Folder not found`,
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Folder Settings</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Manage the settings for this folder.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Name</Trans>
                  </FormLabel>
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
                  <FormLabel>
                    <Trans>Visibility</Trans>
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t`Select visibility`} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={DocumentVisibility.EVERYONE}>
                        <Trans>Everyone</Trans>
                      </SelectItem>
                      <SelectItem value={DocumentVisibility.MANAGER_AND_ABOVE}>
                        <Trans>Managers and above</Trans>
                      </SelectItem>
                      <SelectItem value={DocumentVisibility.ADMIN}>
                        <Trans>Admins only</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">
                  <Trans>Cancel</Trans>
                </Button>
              </DialogClose>

              <Button type="submit" loading={form.formState.isSubmitting}>
                <Trans>Update</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
