'use client';

import { useRef, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { createDocumentThumbnail } from '@documenso/lib/server-only/document-thumbnail/create-document-thumbnail';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { DocumentDataType } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { LazyPDFViewerNoLoader } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type UploadDocumentProps = {
  className?: string;
};

export const UploadDocument = ({ className }: UploadDocumentProps) => {
  const router = useRouter();
  const { data: session } = useSession();

  const { toast } = useToast();

  const { quota, remaining } = useLimits();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createDocument } = trpc.document.createDocument.useMutation();

  const [docData, setDocData] = useState('');
  const [type, setType] = useState<DocumentDataType>();
  const [file, setFile] = useState<File>();

  const onFileDrop = async (file: File) => {
    setIsLoading(true);

    const { type, data } = await putFile(file);

    setDocData(data);
    setFile(file);
    setType(type);
  };

  const createDocuments = async (highResThumbnailBytes: string, lowResThumbnailBytes: string) => {
    try {
      const { id: documentDataId } = await createDocumentData({
        type: type as DocumentDataType,
        data: docData,
      });

      const { id: documentThumbnailId } = await createDocumentThumbnail({
        highResThumbnailBytes,
        lowResThumbnailBytes,
      });

      const { id } = await createDocument({
        title: file?.name || '',
        documentDataId,
        documentThumbnailId,
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

  const generateThumbnail = async (page: number, canvas: HTMLCanvasElement | null) => {
    try {
      if (page !== 1 || !canvas) {
        await createDocuments('', '');
        return;
      }
      // For High Resolution
      const highResTempCanvas = document.createElement('canvas');
      highResTempCanvas.width = canvas.width * 3;
      highResTempCanvas.height = canvas.height * 3;

      const highResCtx = highResTempCanvas.getContext('2d');
      if (highResCtx === null) return;

      // Draw the original canvas onto the temporary canvas
      highResCtx.drawImage(canvas, 0, 0, highResTempCanvas.width, highResTempCanvas.height);

      // Convert the temporary HTMLCanvasElement to a data URL (in PNG format by default)
      const highResDataUrl = highResTempCanvas.toDataURL('image/png');
      console.log(highResDataUrl, 'highResDataUrl');

      // For Low Resolution
      const lowResTempCanvas = document.createElement('canvas');
      lowResTempCanvas.width = canvas.width * 0.5;
      lowResTempCanvas.height = canvas.height * 0.5;
      const lowResCtx = lowResTempCanvas.getContext('2d');
      if (lowResCtx === null) return;

      // Draw the original canvas onto the temporary canvas
      lowResCtx.drawImage(canvas, 0, 0, lowResTempCanvas.width, lowResTempCanvas.height);

      // Convert the temporary HTMLCanvasElement to a data URL (in PNG format by default)
      const lowResDataUrl = highResTempCanvas.toDataURL('image/png');
      console.log(lowResDataUrl, 'lowResDataUrl');
      await createDocuments(highResDataUrl, lowResDataUrl);
    } catch (error) {
      console.log(error);
      toast({
        title: 'Error',
        description: 'An error occurred while uploading your document.',
        variant: 'destructive',
      });
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

      {!!docData && (
        <LazyPDFViewerNoLoader
          className="hidden"
          documentData={{
            id: '',
            data: docData,
            initialData: docData,
            type: DocumentDataType.BYTES_64,
          }}
          maxPages={1}
          onPageRender={generateThumbnail}
        />
      )}
    </div>
  );
};
