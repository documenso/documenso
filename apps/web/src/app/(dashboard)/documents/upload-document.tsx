'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type UploadDocumentProps = {
  className?: string;
  team?: {
    id: number;
    url: string;
  };
};

export const UploadDocument = ({ className, team }: UploadDocumentProps) => {
  const router = useRouter();
  const analytics = useAnalytics();

  const { data: session } = useSession();

  const { _ } = useLingui();
  const { toast } = useToast();

  const { quota, remaining, refreshLimits } = useLimits();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createDocument } = trpc.document.createDocument.useMutation();

  const disabledMessage = useMemo(() => {
    if (remaining.documents === 0) {
      return team
        ? msg`Document upload disabled due to unpaid invoices`
        : msg`You have reached your document limit.`;
    }

    if (!session?.user.emailVerified) {
      return msg`Verify your email to upload documents.`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining.documents, session?.user.emailVerified, team]);

  const onFileDrop = async (file: File) => {
    try {
      setIsLoading(true);

      const { type, data } = await putPdfFile(file);

      const { id: documentDataId } = await createDocumentData({
        type,
        data,
      });

      const { id } = await createDocument({
        title: file.name,
        documentDataId,
        teamId: team?.id,
      });

      void refreshLimits();

      toast({
        title: _(msg`Document uploaded`),
        description: _(msg`Your document has been uploaded successfully.`),
        duration: 5000,
      });

      analytics.capture('App: Document Uploaded', {
        userId: session?.user.id,
        documentId: id,
        timestamp: new Date().toISOString(),
      });

      router.push(`${formatDocumentsPath(team?.url)}/${id}/edit`);
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(err);

      if (error.code === 'INVALID_DOCUMENT_FILE') {
        toast({
          title: _(msg`Invalid file`),
          description: _(msg`You cannot upload encrypted PDFs`),
          variant: 'destructive',
        });
      } else if (err instanceof TRPCClientError) {
        toast({
          title: _(msg`Error`),
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: _(msg`Error`),
          description: _(msg`An error occurred while uploading your document.`),
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onFileDropRejected = () => {
    toast({
      title: _(msg`Your document failed to upload.`),
      description: _(msg`File cannot be larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB`),
      duration: 5000,
      variant: 'destructive',
    });
  };

  return (
    <div className={cn('relative', className)}>
      <DocumentDropzone
        className="h-[min(400px,50vh)]"
        disabled={remaining.documents === 0 || !session?.user.emailVerified}
        disabledMessage={disabledMessage}
        onDrop={onFileDrop}
        onDropRejected={onFileDropRejected}
      />

      <div className="absolute -bottom-6 right-0">
        {team?.id === undefined &&
          remaining.documents > 0 &&
          Number.isFinite(remaining.documents) && (
            <p className="text-muted-foreground/60 text-xs">
              <Trans>
                {remaining.documents} of {quota.documents} documents remaining this month.
              </Trans>
            </p>
          )}
      </div>

      {isLoading && (
        <div className="bg-background/50 absolute inset-0 flex items-center justify-center rounded-lg">
          <Loader className="text-muted-foreground h-12 w-12 animate-spin" />
        </div>
      )}
    </div>
  );
};
