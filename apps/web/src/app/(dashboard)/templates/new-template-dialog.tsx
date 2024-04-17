'use client';

import React, { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { FilePlus, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { base64 } from '@documenso/lib/universal/base64';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZCreateTemplateFormSchema = z.object({
  name: z.string(),
});

type TCreateTemplateFormSchema = z.infer<typeof ZCreateTemplateFormSchema>;

type NewTemplateDialogProps = {
  teamId?: number;
  templateRootPath: string;
};

export const NewTemplateDialog = ({ teamId, templateRootPath }: NewTemplateDialogProps) => {
  const router = useRouter();

  const { data: session } = useSession();
  const { toast } = useToast();

  const form = useForm<TCreateTemplateFormSchema>({
    defaultValues: {
      name: '',
    },
    resolver: zodResolver(ZCreateTemplateFormSchema),
  });

  const { mutateAsync: createTemplate, isLoading: isCreatingTemplate } =
    trpc.template.createTemplate.useMutation();

  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ file: File; fileBase64: string } | null>();

  const onFileDrop = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64String = base64.encode(new Uint8Array(arrayBuffer));

      setUploadedFile({
        file,
        fileBase64: `data:application/pdf;base64,${base64String}`,
      });

      if (!form.getValues('name')) {
        form.setValue('name', file.name);
      }
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: TCreateTemplateFormSchema) => {
    if (!uploadedFile) {
      return;
    }

    const file: File = uploadedFile.file;

    try {
      const { type, data } = await putFile(file);

      const { id: templateDocumentDataId } = await createDocumentData({
        type,
        data,
      });

      const { id } = await createTemplate({
        teamId,
        title: values.name ? values.name : file.name,
        templateDocumentDataId,
      });

      toast({
        title: 'Template document uploaded',
        description:
          'Your document has been uploaded successfully. You will be redirected to the template page.',
        duration: 5000,
      });

      setShowNewTemplateDialog(false);

      router.push(`${templateRootPath}/${id}`);
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    if (form.getValues('name') === uploadedFile?.file.name) {
      form.reset();
    }

    setUploadedFile(null);
  };

  useEffect(() => {
    if (!showNewTemplateDialog) {
      form.reset();
    }
  }, [form, showNewTemplateDialog]);

  return (
    <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
      <DialogTrigger asChild>
        <Button className="cursor-pointer" disabled={!session?.user.emailVerified}>
          <FilePlus className="-ml-1 mr-2 h-4 w-4" />
          New Template
        </Button>
      </DialogTrigger>

      <DialogContent className="w-full max-w-xl">
        <DialogHeader>
          <DialogTitle className="mb-4">New Template</DialogTitle>
        </DialogHeader>

        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name your template</FormLabel>
                    <FormControl>
                      <Input id="email" type="text" className="bg-background mt-1.5" {...field} />
                    </FormControl>
                    <FormDescription>
                      <span className="text-muted-foreground text-xs">
                        Leave this empty if you would like to use your document's name for the
                        template
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label htmlFor="template">Upload a Document</Label>

                <div className="my-3">
                  {uploadedFile ? (
                    <Card gradient className="h-[40vh]">
                      <CardContent className="flex h-full flex-col items-center justify-center p-2">
                        <button
                          onClick={() => resetForm()}
                          title="Remove Template"
                          className="text-muted-foreground absolute right-2.5 top-2.5 rounded-sm opacity-60 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
                        >
                          <X className="h-6 w-6" />
                          <span className="sr-only">Remove Template</span>
                        </button>

                        <div className="border-muted-foreground/20 group-hover:border-documenso/80 dark:bg-muted/80 z-10 flex aspect-[3/4] w-24 flex-col gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm">
                          <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
                          <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-5/6 rounded-[2px]" />
                          <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
                        </div>

                        <p className="group-hover:text-foreground text-muted-foreground mt-4 font-medium">
                          Uploaded Document
                        </p>

                        <span className="text-muted-foreground/80 mt-1 text-sm">
                          {uploadedFile.file.name}
                        </span>
                      </CardContent>
                    </Card>
                  ) : (
                    <DocumentDropzone
                      className="mt-1.5 h-[40vh]"
                      onDrop={onFileDrop}
                      type="template"
                    />
                  )}
                </div>
              </div>

              <div className="flex w-full justify-end">
                <Button loading={isCreatingTemplate} type="submit">
                  Create Template
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
