'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type UploadDocumentProps = {
  className?: string;
};

export const UploadDocument = ({ className }: UploadDocumentProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createDocument } = trpc.document.createDocument.useMutation();

  const onFileDrop = async (file: File) => {
    try {
      setIsLoading(true);

      const { type, data } = await putFile(file);

      const { id: documentDataId } = await createDocumentData({
        type,
        data,
      });

      const { id } = await createDocument({
        title: file.name,
        documentDataId,
      });

      toast({
        title: 'Document uploaded',
        description: 'Your document has been uploaded successfully.',
        duration: 5000,
      });

      router.push(`/documents/${id}`);
    } catch (error) {
      console.error(error);

      toast({
        title: 'Error',
        description: 'An error occurred while uploading your document.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <DocumentDropzone className="min-h-[40vh]" onDrop={onFileDrop} />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Loader className="h-12 w-12 animate-spin text-slate-500" />
        </div>
      )}
    </div>
  );
};
