import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { FolderIcon, HomeIcon, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { FolderType } from '@documenso/lib/types/folder-type';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useOptionalCurrentTeam } from '~/providers/team';

export type DocumentMoveToFolderDialogProps = {
  documentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolderId?: string;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZMoveDocumentFormSchema = z.object({
  folderId: z.string().nullable().optional(),
});

type TMoveDocumentFormSchema = z.infer<typeof ZMoveDocumentFormSchema>;

export const DocumentMoveToFolderDialog = ({
  documentId,
  open,
  onOpenChange,
  currentFolderId,
  ...props
}: DocumentMoveToFolderDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();
  const team = useOptionalCurrentTeam();

  const form = useForm<TMoveDocumentFormSchema>({
    resolver: zodResolver(ZMoveDocumentFormSchema),
    defaultValues: {
      folderId: currentFolderId,
    },
  });

  const { data: folders, isLoading: isFoldersLoading } = trpc.folder.findFolders.useQuery(
    {
      parentId: currentFolderId,
      type: FolderType.DOCUMENT,
    },
    {
      enabled: open,
    },
  );

  const { mutateAsync: moveDocumentToFolder } = trpc.folder.moveDocumentToFolder.useMutation();

  useEffect(() => {
    if (!open) {
      form.reset();
    } else {
      form.reset({ folderId: currentFolderId });
    }
  }, [open, currentFolderId, form]);

  const onSubmit = async (data: TMoveDocumentFormSchema) => {
    try {
      await moveDocumentToFolder({
        documentId,
        folderId: data.folderId ?? null,
      });

      const documentsPath = formatDocumentsPath(team?.url);

      if (data.folderId) {
        await navigate(`${documentsPath}/f/${data.folderId}`);
      } else {
        await navigate(documentsPath);
      }

      toast({
        title: _(msg`Document moved`),
        description: _(msg`The document has been moved successfully.`),
        variant: 'default',
      });

      onOpenChange(false);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.NOT_FOUND) {
        toast({
          title: _(msg`Error`),
          description: _(msg`The folder you are trying to move the document to does not exist.`),
          variant: 'destructive',
        });

        return;
      }

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while moving the document.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog {...props} open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Move Document to Folder</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Select a folder to move this document to.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-y-4">
            <FormField
              control={form.control}
              name="folderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Folder</Trans>
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-2">
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
                            disabled={currentFolderId === null}
                          >
                            <HomeIcon className="mr-2 h-4 w-4" />
                            <Trans>Root (No Folder)</Trans>
                          </Button>

                          {folders?.data.map((folder) => (
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

              <Button
                type="submit"
                disabled={
                  isFoldersLoading || form.formState.isSubmitting || currentFolderId === null
                }
              >
                <Trans>Move</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
