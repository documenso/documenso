import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { FolderIcon, HomeIcon, Loader2, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { FolderType } from '@documenso/lib/types/folder-type';
import { trpc } from '@documenso/trpc/react';
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

export type DocumentsBulkMoveDialogProps = {
  documentIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolderId?: string;
  onSuccess?: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZBulkMoveFormSchema = z.object({
  folderId: z.string().nullable().optional(),
});

type TBulkMoveFormSchema = z.infer<typeof ZBulkMoveFormSchema>;

export const DocumentsBulkMoveDialog = ({
  documentIds,
  open,
  onOpenChange,
  currentFolderId,
  onSuccess,
  ...props
}: DocumentsBulkMoveDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');

  const form = useForm<TBulkMoveFormSchema>({
    resolver: zodResolver(ZBulkMoveFormSchema),
    defaultValues: {
      folderId: currentFolderId,
    },
  });

  const { data: folders, isLoading: isFoldersLoading } = trpc.folder.findFoldersInternal.useQuery(
    {
      parentId: currentFolderId,
      type: FolderType.DOCUMENT,
    },
    {
      enabled: open,
    },
  );

  const { mutateAsync: bulkMoveDocuments } = trpc.document.bulkMove.useMutation();

  const trpcUtils = trpc.useUtils();

  useEffect(() => {
    if (!open) {
      form.reset();
      setSearchTerm('');
    } else {
      form.reset({ folderId: currentFolderId });
    }
  }, [open, currentFolderId, form]);

  const onSubmit = async (data: TBulkMoveFormSchema) => {
    try {
      const result = await bulkMoveDocuments({
        documentIds,
        folderId: data.folderId ?? null,
      });

      await trpcUtils.document.findDocumentsInternal.invalidate();

      toast({
        title: _(msg`Documents moved`),
        description: _(msg`${result.movedCount} document(s) have been moved successfully.`),
        variant: 'default',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = match(error.code)
        .with(
          AppErrorCode.NOT_FOUND,
          () => msg`The folder you are trying to move the documents to does not exist.`,
        )
        .with(AppErrorCode.UNAUTHORIZED, () => msg`You are not allowed to move these documents.`)
        .otherwise(() => msg`An error occurred while moving the documents.`);

      toast({
        title: _(msg`Error`),
        description: _(errorMessage),
        variant: 'destructive',
      });
    }
  };

  const filteredFolders = folders?.data.filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Dialog {...props} open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Move Documents to Folder</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Select a folder to move {documentIds.length} document(s) to.</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={_(msg`Search folders...`)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
            <FormField
              control={form.control}
              name="folderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Folder</Trans>
                  </FormLabel>

                  <FormControl>
                    <div className="max-h-96 space-y-2 overflow-y-auto">
                      {isFoldersLoading ? (
                        <div className="flex h-10 items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant={field.value === null ? 'default' : 'outline'}
                            className="w-full justify-start"
                            onClick={() => field.onChange(null)}
                            disabled={currentFolderId === undefined}
                          >
                            <HomeIcon className="mr-2 h-4 w-4" />
                            <Trans>Home (No Folder)</Trans>
                          </Button>

                          {filteredFolders?.map((folder) => (
                            <Button
                              key={folder.id}
                              type="button"
                              variant={field.value === folder.id ? 'default' : 'outline'}
                              className="w-full justify-start"
                              onClick={() => field.onChange(folder.id)}
                              disabled={currentFolderId === folder.id}
                            >
                              <FolderIcon className="mr-2 h-4 w-4" />
                              {folder.name}
                            </Button>
                          ))}

                          {searchTerm && filteredFolders?.length === 0 && (
                            <div className="px-2 py-2 text-center text-sm text-muted-foreground">
                              <Trans>No folders found</Trans>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" disabled={isFoldersLoading || form.formState.isSubmitting}>
                <Trans>Move</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
