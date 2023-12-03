'use client';

import { useRef, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { DocumentDataType } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type UploadDocumentProps = {
  className?: string;
};

const THUMBNAIL_MAX_DIMENSION = 260;
const THUMBNAIL_TIMEOUT = 500;

export const UploadDocument = ({ className }: UploadDocumentProps) => {
  const router = useRouter();
  const { data: session } = useSession();

  const { toast } = useToast();

  const { quota, remaining } = useLimits();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createDocument } = trpc.document.createDocument.useMutation();

  const [docData, setDocData] = useState('');

  const thumbnailResolveRef = useRef<(value: unknown) => void | null>({ current: null });

  const onFileDrop = async (file: File) => {
    try {
      setIsLoading(true);

      const { type, data } = await putFile(file);

      // render the pdf to generate thumbnail
      setDocData(data);

      // if failed to generate thumbnail in 500ms, skip thumbnail generation
      const thumbnailData = await Promise.race([
        new Promise((resolve) => {
          thumbnailResolveRef.current = resolve;
        }),
        new Promise((resolve) => {
          setTimeout(resolve, THUMBNAIL_TIMEOUT);
        }),
      ]);

      const { id: documentDataId } = await createDocumentData({
        type,
        data,
      });

      const { id } = await createDocument({
        title: file.name,
        documentDataId,
        documentThumbnail: typeof thumbnailData === 'string' ? thumbnailData : undefined,
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

  const generateThumbnail = (page: number, canvas: HTMLCanvasElement | null) => {
    if (page !== 1) return;
    if (!canvas) return;

    try {
      // Determine whether the width or height is the larger side
      let thumbnailWidth, thumbnailHeight;
      if (canvas.width > canvas.height) {
        thumbnailWidth = THUMBNAIL_MAX_DIMENSION;
        thumbnailHeight = (canvas.height / canvas.width) * THUMBNAIL_MAX_DIMENSION;
      } else {
        thumbnailHeight = THUMBNAIL_MAX_DIMENSION;
        thumbnailWidth = (canvas.width / canvas.height) * THUMBNAIL_MAX_DIMENSION;
      }

      // Create a new canvas to resize for thumbnail
      const thumbnailCanvas = document.createElement('canvas');
      thumbnailCanvas.width = thumbnailWidth;
      thumbnailCanvas.height = thumbnailHeight;

      // Copy and scale the content of the original canvas to the new canvas
      const ctx = thumbnailCanvas.getContext('2d');
      if (ctx === null) return thumbnailResolveRef.current?.(undefined);
      ctx.drawImage(canvas, 0, 0, thumbnailWidth, thumbnailHeight);

      // Convert the canvas content to a base64 image
      const base64Image = thumbnailCanvas.toDataURL('image/png'); // You can choose the desired image format

      // Resolve the promise with the base64 image
      thumbnailResolveRef.current?.(base64Image);
    } catch (error) {
      return thumbnailResolveRef.current?.(undefined);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <DocumentDropzone
        className="min-h-[40vh]"
        disabled={remaining.documents === 0 || !session?.user.emailVerified}
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

      {Boolean(docData) && (
        <LazyPDFViewer
          className="hidden"
          documentData={{
            id: '',
            data: docData,
            initialData: docData,
            type: DocumentDataType.BYTES_64,
          }}
          onPageRender={generateThumbnail}
        />
      )}
    </div>
  );
};
