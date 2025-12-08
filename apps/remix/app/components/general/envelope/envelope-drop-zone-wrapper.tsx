import { type ReactNode, useState } from 'react';

import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { Loader } from 'lucide-react';
import {
  ErrorCode as DropzoneErrorCode,
  ErrorCode,
  type FileRejection,
  useDropzone,
} from 'react-dropzone';
import { Link, useNavigate, useParams } from 'react-router';
import { match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT, IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import type { TCreateEnvelopePayload } from '@documenso/trpc/server/envelope-router/create-envelope.types';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export interface EnvelopeDropZoneWrapperProps {
  children: ReactNode;
  type: EnvelopeType;
  className?: string;
}

export const EnvelopeDropZoneWrapper = ({
  children,
  type,
  className,
}: EnvelopeDropZoneWrapperProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();
  const { folderId } = useParams();

  const team = useCurrentTeam();

  const navigate = useNavigate();
  const analytics = useAnalytics();
  const organisation = useCurrentOrganisation();

  const [isLoading, setIsLoading] = useState(false);

  const userTimezone =
    TIME_ZONES.find((timezone) => timezone === Intl.DateTimeFormat().resolvedOptions().timeZone) ??
    DEFAULT_DOCUMENT_TIME_ZONE;

  const { quota, remaining, refreshLimits, maximumEnvelopeItemCount } = useLimits();

  const { mutateAsync: createEnvelope } = trpc.envelope.create.useMutation();

  const isUploadDisabled = remaining.documents === 0 || !user.emailVerified;

  const onFileDrop = async (files: File[]) => {
    if (isUploadDisabled && IS_BILLING_ENABLED()) {
      await navigate(`/o/${organisation.url}/settings/billing`);
      return;
    }

    try {
      setIsLoading(true);

      const payload = {
        folderId,
        type,
        title: files[0].name,
        meta: {
          timezone: userTimezone,
        },
      } satisfies TCreateEnvelopePayload;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));

      for (const file of files) {
        formData.append('files', file);
      }

      const { id } = await createEnvelope(formData);

      void refreshLimits();

      toast({
        title: type === EnvelopeType.DOCUMENT ? t`Document uploaded` : t`Template uploaded`,
        description:
          type === EnvelopeType.DOCUMENT
            ? t`Your document has been uploaded successfully.`
            : t`Your template has been uploaded successfully.`,
        duration: 5000,
      });

      if (type === EnvelopeType.DOCUMENT) {
        analytics.capture('App: Document Uploaded', {
          userId: user.id,
          documentId: id,
          timestamp: new Date().toISOString(),
        });
      }

      const pathPrefix =
        type === EnvelopeType.DOCUMENT
          ? formatDocumentsPath(team.url)
          : formatTemplatesPath(team.url);

      const aiQueryParam = team.preferences.aiFeaturesEnabled ? '?ai=true' : '';

      await navigate(`${pathPrefix}/${id}/edit${aiQueryParam}`);
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = match(error.code)
        .with('INVALID_DOCUMENT_FILE', () => t`You cannot upload encrypted PDFs`)
        .with(
          AppErrorCode.LIMIT_EXCEEDED,
          () => t`You have reached your document limit for this month. Please upgrade your plan.`,
        )
        .with(
          'ENVELOPE_ITEM_LIMIT_EXCEEDED',
          () => t`You have reached the limit of the number of files per envelope`,
        )
        .otherwise(() => t`An error occurred during upload.`);

      toast({
        title: t`Error`,
        description: errorMessage,
        variant: 'destructive',
        duration: 7500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onFileDropRejected = (fileRejections: FileRejection[]) => {
    if (!fileRejections.length) {
      return;
    }

    const maxItemsReached = fileRejections.some((fileRejection) =>
      fileRejection.errors.some((error) => error.code === DropzoneErrorCode.TooManyFiles),
    );

    if (maxItemsReached) {
      toast({
        title: plural(maximumEnvelopeItemCount, {
          one: `You cannot upload more than # item per envelope.`,
          other: `You cannot upload more than # items per envelope.`,
        }),
        duration: 5000,
        variant: 'destructive',
      });

      return;
    }

    // Since users can only upload only one file (no multi-upload), we only handle the first file rejection
    const { file, errors } = fileRejections[0];

    if (!errors.length) {
      return;
    }

    const errorNodes = errors.map((error, index) => (
      <span key={index} className="block">
        {match(error.code)
          .with(ErrorCode.FileTooLarge, () => (
            <Trans>File is larger than {APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB</Trans>
          ))
          .with(ErrorCode.FileInvalidType, () => <Trans>Only PDF files are allowed</Trans>)
          .with(ErrorCode.FileTooSmall, () => <Trans>File is too small</Trans>)
          .with(ErrorCode.TooManyFiles, () => (
            <Trans>Only one file can be uploaded at a time</Trans>
          ))
          .otherwise(() => (
            <Trans>Unknown error</Trans>
          ))}
      </span>
    ));

    const description = (
      <>
        <span className="font-medium">
          <Trans>{file.name} couldn't be uploaded:</Trans>
        </span>
        {errorNodes}
      </>
    );

    toast({
      title: t`Upload failed`,
      description,
      duration: 5000,
      variant: 'destructive',
    });
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    maxSize: megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT),
    maxFiles: maximumEnvelopeItemCount,
    onDrop: (files) => void onFileDrop(files),
    onDropRejected: onFileDropRejected,
    noClick: true,
    noDragEventsBubbling: true,
  });

  return (
    <div {...getRootProps()} className={cn('relative min-h-screen', className)}>
      <input {...getInputProps()} />
      {children}

      {isDragActive && (
        <div className="fixed left-0 top-0 z-[9999] h-full w-full bg-muted/60 backdrop-blur-[4px]">
          <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center">
            <h2 className="text-2xl font-semibold text-foreground">
              {type === EnvelopeType.DOCUMENT ? (
                <Trans>Upload Document</Trans>
              ) : (
                <Trans>Upload Template</Trans>
              )}
            </h2>

            <p className="text-md mt-4 text-muted-foreground">
              <Trans>Drag and drop your PDF file here</Trans>
            </p>

            {isUploadDisabled && IS_BILLING_ENABLED() && (
              <Link
                to={`/o/${organisation.url}/settings/billing`}
                className="mt-4 text-sm text-amber-500 hover:underline dark:text-amber-400"
              >
                <Trans>Upgrade your plan to upload more documents</Trans>
              </Link>
            )}

            {!isUploadDisabled &&
              team?.id === undefined &&
              remaining.documents > 0 &&
              Number.isFinite(remaining.documents) && (
                <p className="mt-4 text-sm text-muted-foreground/80">
                  <Trans>
                    {remaining.documents} of {quota.documents} documents remaining this month.
                  </Trans>
                </p>
              )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-50 bg-muted/30 backdrop-blur-[2px]">
          <div className="pointer-events-none flex h-1/2 w-full flex-col items-center justify-center">
            <Loader className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-8 font-medium text-foreground">
              <Trans>Uploading</Trans>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
