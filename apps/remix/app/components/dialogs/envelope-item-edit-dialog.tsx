import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangleIcon, FileIcon, UploadIcon, XIcon } from 'lucide-react';
import { type FileRejection, useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { trpc } from '@documenso/trpc/react';
import { ZDocumentTitleSchema } from '@documenso/trpc/server/document-router/schema';
import type { TReplaceEnvelopeItemPdfPayload } from '@documenso/trpc/server/envelope-router/replace-envelope-item-pdf.types';
import { buildDropzoneRejectionDescription } from '@documenso/ui/lib/handle-dropzone-rejection';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
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

const ZEditEnvelopeItemFormSchema = z.object({
  title: ZDocumentTitleSchema,
});

type TEditEnvelopeItemFormSchema = z.infer<typeof ZEditEnvelopeItemFormSchema>;

/**
 * Note: This should only be visible if the envelope item is editable.
 */
export type EnvelopeItemEditDialogProps = {
  envelopeItem: { id: string; title: string };
  allowConfigureTitle: boolean;
  trigger: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const EnvelopeItemEditDialog = ({
  envelopeItem,
  allowConfigureTitle,
  trigger,
  ...props
}: EnvelopeItemEditDialogProps) => {
  const { t, i18n } = useLingui();
  const { toast } = useToast();

  const { envelope, editorFields, setLocalEnvelope, isEmbedded } = useCurrentEnvelopeEditor();

  const [isOpen, setIsOpen] = useState(false);
  const [replacementFile, setReplacementFile] = useState<{ file: File; pageCount: number } | null>(
    null,
  );
  const [isDropping, setIsDropping] = useState(false);

  const form = useForm<TEditEnvelopeItemFormSchema>({
    resolver: zodResolver(ZEditEnvelopeItemFormSchema),
    defaultValues: {
      title: envelopeItem.title,
    },
  });

  const { mutateAsync: replaceEnvelopeItemPdf } = trpc.envelope.item.replacePdf.useMutation({
    onSuccess: ({ data, fields }) => {
      setLocalEnvelope({
        envelopeItems: envelope.envelopeItems.map((item) =>
          item.id === data.id
            ? { ...item, documentDataId: data.documentDataId, title: data.title }
            : item,
        ),
      });

      if (fields) {
        setLocalEnvelope({ fields });
        editorFields.resetForm(fields);
      }
    },
  });

  const fieldsOnExcessPages =
    replacementFile !== null
      ? envelope.fields.filter(
          (field) =>
            field.envelopeItemId === envelopeItem.id && field.page > replacementFile.pageCount,
        )
      : [];

  const onFileDropRejected = (fileRejections: FileRejection[]) => {
    toast({
      title: t`Upload failed`,
      description: i18n._(buildDropzoneRejectionDescription(fileRejections)),
      duration: 5000,
      variant: 'destructive',
    });
  };

  const onFileDrop = async (files: File[]) => {
    const file = files[0];

    if (!file || isDropping) {
      return;
    }

    setIsDropping(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer.slice(0));
      const { PDF } = await import('@libpdf/core');
      const pdfDoc = await PDF.load(fileData);

      setReplacementFile({
        file,
        pageCount: pdfDoc.getPageCount(),
      });
    } catch (err) {
      console.error(err);

      toast({
        title: t`Failed to read file`,
        description: t`The file is not a valid PDF.`,
        variant: 'destructive',
      });
    }

    setIsDropping(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT),
    disabled: form.formState.isSubmitting,
    onDrop: (files) => void onFileDrop(files),
    onDropRejected: onFileDropRejected,
  });

  const onSubmit = async (data: TEditEnvelopeItemFormSchema) => {
    if (isDropping || !replacementFile) {
      return;
    }

    try {
      const { file, pageCount } = replacementFile;

      if (isEmbedded) {
        const arrayBuffer = await file.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer.slice(0));

        const remainingFields = envelope.fields.filter(
          (field) => field.envelopeItemId !== envelopeItem.id || field.page <= pageCount,
        );

        setLocalEnvelope({
          envelopeItems: envelope.envelopeItems.map((item) =>
            item.id === envelopeItem.id ? { ...item, title: data.title, data: fileData } : item,
          ),
          fields: remainingFields,
        });

        editorFields.resetForm(remainingFields);
      } else {
        const payload = {
          envelopeId: envelope.id,
          envelopeItemId: envelopeItem.id,
          title: data.title,
        } satisfies TReplaceEnvelopeItemPdfPayload;

        const formData = new FormData();
        formData.append('payload', JSON.stringify(payload));
        formData.append('file', file);

        await replaceEnvelopeItemPdf(formData);
      }

      setIsOpen(false);
    } catch {
      toast({
        title: t`Failed to update item`,
        description: t`Something went wrong while updating the envelope item.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset({ title: envelopeItem.title });
      setReplacementFile(null);
      setIsDropping(false);
    }
  }, [isOpen, form, envelopeItem.title]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog
      {...props}
      open={isOpen}
      onOpenChange={(value) => !form.formState.isSubmitting && setIsOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Edit Item</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Update the title or replace the PDF file.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Document Title</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="envelope-item-edit-title-input"
                        placeholder={t`Document Title`}
                        disabled={!allowConfigureTitle}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>
                  <Trans>Replace PDF</Trans>
                </FormLabel>

                {replacementFile ? (
                  <div className="mt-1.5 space-y-2">
                    <div
                      data-testid="envelope-item-edit-selected-file"
                      className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center space-x-2">
                        <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {replacementFile.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(replacementFile.file.size)}
                            {isDropping ? ' · …' : ' · '}
                            {!isDropping && replacementFile.pageCount !== null && (
                              <Plural
                                one="1 page"
                                other="# pages"
                                value={replacementFile.pageCount}
                              />
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid="envelope-item-edit-clear-file"
                        onClick={() => {
                          setReplacementFile(null);
                        }}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>

                    {fieldsOnExcessPages.length > 0 && (
                      <Alert variant="warning" padding="tight">
                        <AlertTriangleIcon className="h-4 w-4" />
                        <AlertDescription data-testid="envelope-item-edit-field-warning">
                          <Plural
                            one="1 field will be deleted because the new PDF has fewer pages than the current one."
                            other="# fields will be deleted because the new PDF has fewer pages than the current one."
                            value={fieldsOnExcessPages.length}
                          />
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div
                    data-testid="envelope-item-edit-dropzone"
                    {...getRootProps()}
                    className={cn(
                      'mt-1.5 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border px-4 py-4 transition-colors',
                      isDragActive
                        ? 'border-primary/50 bg-primary/5'
                        : 'hover:border-muted-foreground/50 hover:bg-muted/50',
                    )}
                  >
                    <input {...getInputProps()} />
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <UploadIcon className="h-4 w-4" />
                      <span>
                        <Trans>Drop PDF here or click to select</Trans>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    <Trans>Cancel</Trans>
                  </Button>
                </DialogClose>

                <Button
                  type="submit"
                  loading={form.formState.isSubmitting}
                  disabled={isDropping || !replacementFile}
                  data-testid="envelope-item-edit-update-button"
                >
                  <Trans>Update</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
