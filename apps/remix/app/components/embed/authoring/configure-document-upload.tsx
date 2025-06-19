import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Cloud, FileText, Loader, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useFormContext } from 'react-hook-form';

import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useConfigureDocument } from './configure-document-context';
import type { TConfigureEmbedFormSchema } from './configure-document-view.types';

export interface ConfigureDocumentUploadProps {
  isSubmitting?: boolean;
}

export const ConfigureDocumentUpload = ({ isSubmitting = false }: ConfigureDocumentUploadProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { isPersisted } = useConfigureDocument();

  const form = useFormContext<TConfigureEmbedFormSchema>();

  const [isLoading, setIsLoading] = useState(false);

  // Watch the documentData field from the form
  const documentData = form.watch('documentData');

  const onFileDrop = async (acceptedFiles: File[]) => {
    try {
      const file = acceptedFiles[0];

      if (!file) {
        return;
      }

      setIsLoading(true);

      // Convert file to UInt8Array
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Store file metadata and UInt8Array in form data
      form.setValue('documentData', {
        name: file.name,
        type: file.type,
        size: file.size,
        data: uint8Array, // Store as UInt8Array
      });

      // Auto-populate title if it's empty
      const currentTitle = form.getValues('title');

      if (!currentTitle) {
        // Get filename without extension
        const fileNameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
        form.setValue('title', fileNameWithoutExtension);
      }
    } catch (error) {
      console.error('Error uploading file', error);

      toast({
        title: _(msg`Error uploading file`),
        description: _(msg`There was an error uploading your file. Please try again.`),
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onDropRejected = () => {
    toast({
      title: _(msg`Your document failed to upload.`),
      description: _(msg`File cannot be larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB`),
      duration: 5000,
      variant: 'destructive',
    });
  };

  const onRemoveFile = () => {
    if (isPersisted) {
      toast({
        title: _(msg`Cannot remove document`),
        description: _(msg`The document is already saved and cannot be changed.`),
        duration: 5000,
        variant: 'destructive',
      });
      return;
    }

    form.unregister('documentData');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';

    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: APP_DOCUMENT_UPLOAD_SIZE_LIMIT * 1024 * 1024,
    multiple: false,
    disabled: isSubmitting || isLoading || isPersisted,
    onDrop: (files) => {
      void onFileDrop(files);
    },
    onDropRejected,
  });

  return (
    <div>
      <FormField
        control={form.control}
        name="documentData"
        render={() => (
          <FormItem>
            <FormLabel required>
              <Trans>Upload Document</Trans>
            </FormLabel>

            <div className="relative">
              {!documentData ? (
                <div className="relative">
                  <FormControl>
                    <div
                      {...getRootProps()}
                      className={cn(
                        'border-border bg-background relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition',
                        {
                          'border-primary/50 bg-primary/5': isDragActive,
                          'hover:bg-muted/30':
                            !isDragActive && !isSubmitting && !isLoading && !isPersisted,
                          'cursor-not-allowed opacity-60': isSubmitting || isLoading || isPersisted,
                        },
                      )}
                    >
                      <input {...getInputProps()} />

                      <div className="flex flex-col items-center justify-center gap-y-2 px-4 py-4 text-center">
                        <Cloud
                          className={cn('h-10 w-10', {
                            'text-primary': isDragActive,
                            'text-muted-foreground': !isDragActive,
                          })}
                        />

                        <div
                          className={cn('flex flex-col space-y-1', {
                            'text-primary': isDragActive,
                            'text-muted-foreground': !isDragActive,
                          })}
                        >
                          <p className="text-sm font-medium">
                            {isDragActive ? (
                              <Trans>Drop your document here</Trans>
                            ) : isPersisted ? (
                              <Trans>Document is already uploaded</Trans>
                            ) : (
                              <Trans>Drag and drop or click to upload</Trans>
                            )}
                          </p>
                          <p className="text-xs">
                            {isPersisted ? (
                              <Trans>This document cannot be changed</Trans>
                            ) : (
                              <Trans>
                                .PDF documents accepted (max {APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB)
                              </Trans>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </FormControl>

                  {isLoading && (
                    <div className="bg-background/50 absolute inset-0 flex items-center justify-center rounded-lg">
                      <Loader className="text-muted-foreground h-10 w-10 animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 rounded-lg border p-4">
                  <div className="flex items-center gap-x-4">
                    <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-md">
                      <FileText className="h-6 w-6" />
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-medium">{documentData.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatFileSize(documentData.size)}
                      </div>
                    </div>

                    {!isPersisted && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRemoveFile}
                        disabled={isSubmitting}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
