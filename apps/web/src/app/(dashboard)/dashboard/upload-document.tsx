'use client';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCreateDocument } from '~/api/document/create/fetcher';
import { DocumentDropzone } from '~/components/(dashboard)/document-dropzone/document-dropzone';

export type UploadDocumentProps = {
  className?: string;
};

export const UploadDocument = ({ className }: UploadDocumentProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const { isLoading, mutateAsync: createDocument } = useCreateDocument();

  const onFileDrop = async (file: File) => {
    try {
      const { id } = await createDocument({
        file: file,
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
