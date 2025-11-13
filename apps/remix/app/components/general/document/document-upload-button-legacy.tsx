import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { useNavigate, useParams } from 'react-router';
import { match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import type { TCreateDocumentPayloadSchema } from '@documenso/trpc/server/document-router/create-document.types';
import { cn } from '@documenso/ui/lib/utils';
import { DocumentUploadButton as DocumentUploadButtonPrimitive } from '@documenso/ui/primitives/document-upload-button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export type DocumentUploadButtonLegacyProps = {
  className?: string;
};

export const DocumentUploadButtonLegacy = ({ className }: DocumentUploadButtonLegacyProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();
  const { folderId } = useParams();

  const team = useCurrentTeam();

  const navigate = useNavigate();
  const analytics = useAnalytics();
  const organisation = useCurrentOrganisation();

  const userTimezone =
    TIME_ZONES.find((timezone) => timezone === Intl.DateTimeFormat().resolvedOptions().timeZone) ??
    DEFAULT_DOCUMENT_TIME_ZONE;

  const { quota, remaining, refreshLimits } = useLimits();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createDocument } = trpc.document.create.useMutation();

  const disabledMessage = useMemo(() => {
    if (organisation.subscription && remaining.documents === 0) {
      return msg`Document upload disabled due to unpaid invoices`;
    }

    if (remaining.documents === 0) {
      return msg`You have reached your document limit.`;
    }

    if (!user.emailVerified) {
      return msg`Verify your email to upload documents.`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining.documents, user.emailVerified, team]);

  const onFileDrop = async (file: File) => {
    try {
      setIsLoading(true);

      const payload = {
        title: file.name,
        folderId: folderId ?? undefined,
        meta: {
          timezone: userTimezone,
        },
      } satisfies TCreateDocumentPayloadSchema;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append('file', file);

      const { envelopeId: id } = await createDocument(formData);

      void refreshLimits();

      await navigate(`${formatDocumentsPath(team.url)}/${id}/edit`);

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
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(err);

      const errorMessage = match(error.code)
        .with('INVALID_DOCUMENT_FILE', () => msg`You cannot upload encrypted PDFs`)
        .with(
          AppErrorCode.LIMIT_EXCEEDED,
          () => msg`You have reached your document limit for this month. Please upgrade your plan.`,
        )
        .with(
          'ENVELOPE_ITEM_LIMIT_EXCEEDED',
          () => msg`You have reached the limit of the number of files per envelope`,
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

  return (
    <div className={cn('relative', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <DocumentUploadButtonPrimitive
                loading={isLoading}
                disabled={remaining.documents === 0 || !user.emailVerified}
                disabledMessage={disabledMessage}
                onDrop={async (files) => onFileDrop(files[0])}
                onDropRejected={onFileDropRejected}
                type={EnvelopeType.DOCUMENT}
                internalVersion="1"
              />
            </div>
          </TooltipTrigger>

          {team?.id === undefined &&
            remaining.documents > 0 &&
            Number.isFinite(remaining.documents) && (
              <TooltipContent>
                <p className="text-sm">
                  <Trans>
                    {remaining.documents} of {quota.documents} documents remaining this month.
                  </Trans>
                </p>
              </TooltipContent>
            )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
