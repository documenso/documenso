import { type ReactNode, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { Loader, Plus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate, useParams } from 'react-router';
import { match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT, IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useOptionalCurrentTeam } from '~/providers/team';

const DocumentDropzoneContainerVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

export interface DocumentDropZoneWrapperProps {
  children: ReactNode;
  className?: string;
}

export const DocumentDropZoneWrapper = ({ children, className }: DocumentDropZoneWrapperProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();
  const { folderId } = useParams();

  const team = useOptionalCurrentTeam();

  const navigate = useNavigate();
  const analytics = useAnalytics();

  const [isLoading, setIsLoading] = useState(false);

  const userTimezone =
    TIME_ZONES.find((timezone) => timezone === Intl.DateTimeFormat().resolvedOptions().timeZone) ??
    DEFAULT_DOCUMENT_TIME_ZONE;

  const { quota, remaining, refreshLimits } = useLimits();

  const { mutateAsync: createDocument } = trpc.document.createDocument.useMutation();

  const isUploadDisabled = remaining.documents === 0 || !user.emailVerified;

  const onFileDrop = async (file: File) => {
    if (isUploadDisabled && IS_BILLING_ENABLED()) {
      await navigate('/settings/billing');
      return;
    }

    try {
      setIsLoading(true);

      const response = await putPdfFile(file);

      const { id } = await createDocument({
        title: file.name,
        documentDataId: response.id,
        timezone: userTimezone,
        folderId: folderId ?? undefined,
      });

      void refreshLimits();

      toast({
        title: _(msg`Document uploaded`),
        description: _(msg`Your document has been uploaded successfully.`),
        duration: 5000,
      });

      analytics.capture('App: Document Uploaded', {
        userId: user.id,
        documentId: id,
        timestamp: new Date().toISOString(),
      });

      await navigate(
        folderId
          ? `${formatDocumentsPath(team?.url)}/f/${folderId}/${id}/edit`
          : `${formatDocumentsPath(team?.url)}/${id}/edit`,
      );
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(err);

      const errorMessage = match(error.code)
        .with('INVALID_DOCUMENT_FILE', () => msg`You cannot upload encrypted PDFs`)
        .with(
          AppErrorCode.LIMIT_EXCEEDED,
          () => msg`You have reached your document limit for this month. Please upgrade your plan.`,
        )
        .otherwise(() => msg`An error occurred while uploading your document.`);

      toast({
        title: _(msg`Error`),
        description: _(errorMessage),
        variant: 'destructive',
        duration: 7500,
      });
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    //disabled: isUploadDisabled,
    multiple: false,
    maxSize: megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT),
    onDrop: ([acceptedFile]) => {
      if (acceptedFile) {
        void onFileDrop(acceptedFile);
      }
    },
    onDropRejected: () => {
      void onFileDropRejected();
    },
    noClick: true,
    noDragEventsBubbling: true,
  });

  return (
    <div {...getRootProps()} className={cn('relative min-h-screen', className)}>
      <input {...getInputProps()} />
      {children}

      {isDragActive && (
        <div className="bg-muted/60 absolute inset-0 z-50 backdrop-blur-[4px]">
          <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center">
            <motion.div
              variants={DocumentDropzoneContainerVariants}
              initial="initial"
              animate="animate"
            >
              <Card
                className="bg-background/60 flex flex-1 flex-col items-center justify-center"
                gradient
              >
                <CardContent className="text-muted-foreground/40 flex flex-col items-center justify-center p-6">
                  <div className="flex">
                    <div className="border-muted-foreground/20 dark:bg-muted/80 z-10 flex aspect-[3/4] w-48 origin-top-right -rotate-[22deg] flex-col gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm">
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]" />
                      <div className="bg-muted-foreground/20 h-2 w-5/6 rounded-[2px]" />
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]" />
                    </div>

                    <div className="border-muted-foreground/20 dark:bg-muted/80 z-20 flex aspect-[3/4] w-48 flex-col items-center justify-center gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm">
                      <Plus strokeWidth="2px" className="text-muted-foreground/20 h-12 w-12" />
                    </div>

                    <div className="border-muted-foreground/20 dark:bg-muted/80 z-10 flex aspect-[3/4] w-48 origin-top-left rotate-[22deg] flex-col gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm">
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]" />
                      <div className="bg-muted-foreground/20 h-2 w-5/6 rounded-[2px]" />
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]" />
                    </div>
                  </div>

                  <p className="text-foreground mt-8 font-medium">
                    <Trans>Add a document</Trans>
                  </p>

                  <p className="text-muted-foreground/60 mt-4 text-sm">
                    <Trans>Drag and drop your PDF file here</Trans>
                  </p>

                  {isUploadDisabled && IS_BILLING_ENABLED() && (
                    <Link
                      to="/settings/billing"
                      className="mt-4 text-sm text-amber-500 hover:underline dark:text-amber-400"
                    >
                      <Trans>Upgrade your plan to upload more documents</Trans>
                    </Link>
                  )}

                  {!isUploadDisabled &&
                    team?.id === undefined &&
                    remaining.documents > 0 &&
                    Number.isFinite(remaining.documents) && (
                      <p className="text-muted-foreground/60 mt-4 text-sm">
                        <Trans>
                          {remaining.documents} of {quota.documents} documents remaining this month.
                        </Trans>
                      </p>
                    )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="bg-muted/30 absolute inset-0 z-50 backdrop-blur-[2px]">
          <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center">
            <Card className="bg-background/60 flex w-full max-w-[48rem] flex-col items-center justify-center">
              <CardContent className="text-muted-foreground/40 flex w-full flex-col items-center justify-center p-6">
                <div className="flex">
                  <div className="border-muted-foreground/20 dark:bg-muted/80 z-10 flex aspect-[3/4] w-48 origin-top-right -rotate-[22deg] flex-col gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm">
                    <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]" />
                    <div className="bg-muted-foreground/20 h-2 w-5/6 rounded-[2px]" />
                    <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]" />
                  </div>

                  <div className="border-muted-foreground/20 dark:bg-muted/80 z-20 flex aspect-[3/4] w-48 flex-col items-center justify-center gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm">
                    <Loader className="text-primary h-12 w-12 animate-spin" />
                  </div>

                  <div className="border-muted-foreground/20 dark:bg-muted/80 z-10 flex aspect-[3/4] w-48 origin-top-left rotate-[22deg] flex-col gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm">
                    <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]" />
                    <div className="bg-muted-foreground/20 h-2 w-5/6 rounded-[2px]" />
                    <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]" />
                  </div>
                </div>

                <p className="text-foreground mt-8 font-medium">
                  <Trans>Uploading document...</Trans>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
