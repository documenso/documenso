'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

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

  const { toast } = useToast();

  const { quota, remaining, refreshLimits } = useLimits();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createDocument } = trpc.document.createDocument.useMutation();

  const disabledMessage = useMemo(() => {
    if (remaining.documents === 0) {
      return team
        ? 'დოკუმენტის ატვირთვა შეუძლებელია დავალიანების გამო.'
        : 'თქვენ მიაღწიეთ დოკუმენტების რაოდენობის ლიმიტს.';
    }

    if (!session?.user.emailVerified) {
      return 'დოკუმენტის ასატვირთად დაადასტურეთ თქვენი ელ.ფოსტა.';
    }
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
        title: 'დოკუმენტი ატვირთულია',
        description: 'თქვენი დოკუმენტი წარმატებით აიტვირთა!',
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
          title: 'არასწორი ფაილი',
          description: 'თქვენ არ შეგიძლიათ ატვირთოთ დაშიფრული PDF ფაილები',
          variant: 'destructive',
        });
      } else if (err instanceof TRPCClientError) {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: 'დოკუმენტის ატვირთვისას დაფიქსირდა ხარვეზი.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onFileDropRejected = () => {
    toast({
      title: 'დოკუმენტი ვერ აიტვირთა.',
      description: `ფაილის ზომა არ უნდა აჭარბებდეს ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB-ს`,
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
              ამ თვეში დარჩენილია {quota.documents}-იდან {remaining.documents} დოკუმენტი.
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
