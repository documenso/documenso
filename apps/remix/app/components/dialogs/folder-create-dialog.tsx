import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { FolderType } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { FolderPlusIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
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

const ZCreateFolderFormSchema = z.object({
  name: z.string().min(1, { message: 'Folder name is required' }),
});

type TCreateFolderFormSchema = z.infer<typeof ZCreateFolderFormSchema>;

export type FolderCreateDialogProps = {
  type: FolderType;
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const FolderCreateDialog = ({ type, trigger, ...props }: FolderCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { folderId } = useParams();

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  const { mutateAsync: createFolder } = trpc.folder.createFolder.useMutation();

  const form = useForm<TCreateFolderFormSchema>({
    resolver: zodResolver(ZCreateFolderFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = async (data: TCreateFolderFormSchema) => {
    try {
      await createFolder({
        name: data.name,
        parentId: folderId,
        type,
      });

      setIsCreateFolderOpen(false);

      toast({
        description: t`Folder created successfully`,
      });
    } catch (err) {
      toast({
        title: t`Failed to create folder`,
        description: t`An unknown error occurred while creating the folder.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!isCreateFolderOpen) {
      form.reset();
    }
  }, [isCreateFolderOpen, form]);

  return (
    <Dialog {...props} open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className="flex items-center"
            data-testid="folder-create-button"
          >
            <FolderPlusIcon className="mr-2 h-4 w-4" />
            <Trans>Create Folder</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Create New Folder</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Enter a name for your new folder. Folders help you organise your items.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Folder Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t`My Folder`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateFolderOpen(false)}
                >
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Create</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
