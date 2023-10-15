'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { TRPCClientError } from '@documenso/trpc/client';
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

  const { quota, remaining } = useLimits();

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

      if (error instanceof TRPCClientError) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'An error occurred while uploading your document.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <DocumentDropzone
        className="min-h-[40vh]"
        disabled={remaining.documents === 0}
        onDrop={onFileDrop}
      />

      <div className="absolute -bottom-6 right-0">
        {remaining.documents > 0 && Number.isFinite(remaining.documents) && (
          <p className="text-muted-foreground/60 text-xs">
            {remaining.documents} of {quota.documents} documents remaining this month.
          </p>
        )}
      </div>

      {isLoading && (
        <div className="bg-background/50 absolute inset-0 flex items-center justify-center rounded-lg">
          <Loader className="text-muted-foreground h-12 w-12 animate-spin" />
        </div>
      )}

      {remaining.documents === 0 && (
        <div className="bg-background/60 absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-sm">
          <div className="text-center">
            <h2 className="text-muted-foreground/80 text-xl font-semibold">
              You have reached your document limit.
            </h2>

            <p className="text-muted-foreground/60 mt-2 text-sm">
              You can upload up to {quota.documents} documents per month on your current plan.
            </p>

            <Link
              className="text-primary hover:text-primary/80 mt-6 block font-medium"
              href="/settings/billing"
            >
              Upgrade your account to upload more documents.
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
