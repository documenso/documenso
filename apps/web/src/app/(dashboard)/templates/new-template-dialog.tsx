'use client';

import React, { useState } from 'react';

import { useRouter } from 'next/navigation';

import { FilePlus } from 'lucide-react';

import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const NewTemplateDialog = () => {
  const router = useRouter();
  const { toast } = useToast();

  const { mutateAsync: createTemplate } = trpc.template.createTemplate.useMutation();

  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);

  const onFileDrop = async (file: File) => {
    try {
      const { type, data } = await putFile(file);

      const { id: templateDocumentDataId } = await createDocumentData({
        type,
        data,
      });

      const { id } = await createTemplate({
        title: file.name,
        templateDocumentDataId,
      });

      toast({
        title: 'Template document uploaded',
        description:
          'Your document has been uploaded successfully. You will be redirected to the template page.',
        duration: 5000,
      });

      setShowNewTemplateDialog(false);

      void router.push(`/templates/${id}`);
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
      <DialogTrigger asChild>
        <Button className="cursor-pointer">
          <>
            <FilePlus className="-ml-1 mr-2 h-4 w-4" />
            New Template
          </>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-xl">
        <DialogHeader>
          <DialogTitle className="mb-4">Upload Template Document</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <DocumentDropzone className="h-[30vh] max-h-[60rem]" onDrop={onFileDrop} />
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
};
