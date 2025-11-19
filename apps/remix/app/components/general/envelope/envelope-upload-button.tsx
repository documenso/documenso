import { useMemo, useState } from 'react';

import { msg, plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { ErrorCode as DropzoneErrorCode, type FileRejection } from 'react-dropzone';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import type { TCreateEnvelopePayload } from '@documenso/trpc/server/envelope-router/create-envelope.types';
import { cn } from '@documenso/ui/lib/utils';
import { DocumentUploadButton } from '@documenso/ui/primitives/document-upload-button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { RecipientDetectionPromptDialog } from '~/components/dialogs/recipient-detection-prompt-dialog';
import { useCurrentTeam } from '~/providers/team';
import { detectFieldsInDocument } from '~/utils/detect-document-fields';
import {
  type RecipientForCreation,
  detectRecipientsInDocument,
  ensureRecipientEmails,
} from '~/utils/detect-document-recipients';

export type EnvelopeUploadButtonProps = {
  className?: string;
  type: EnvelopeType;
  folderId?: string;
};

/**
 * Upload an envelope
 */
export const EnvelopeUploadButton = ({ className, type, folderId }: EnvelopeUploadButtonProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();

  const team = useCurrentTeam();

  const navigate = useNavigate();
  const organisation = useCurrentOrganisation();

  const userTimezone = TIME_ZONES.find(
    (timezone) => timezone === Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  const { quota, remaining, refreshLimits, maximumEnvelopeItemCount } = useLimits();

  const [isLoading, setIsLoading] = useState(false);
  const [showExtractionPrompt, setShowExtractionPrompt] = useState(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const [pendingRecipients, setPendingRecipients] = useState<RecipientForCreation[] | null>(null);
  const [shouldNavigateAfterPromptClose, setShouldNavigateAfterPromptClose] = useState(true);
  const [isAutoAddingFields, setIsAutoAddingFields] = useState(false);

  const { mutateAsync: createEnvelope } = trpc.envelope.create.useMutation();
  const { mutateAsync: createRecipients } = trpc.envelope.recipient.createMany.useMutation();

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

  const onFileDrop = async (files: File[]) => {
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

      const { id } = await createEnvelope(formData).catch((error) => {
        console.error(error);

        throw error;
      });

      void refreshLimits();

      const pathPrefix =
        type === EnvelopeType.DOCUMENT
          ? formatDocumentsPath(team.url)
          : formatTemplatesPath(team.url);

      if (type === EnvelopeType.DOCUMENT) {
        setUploadedDocumentId(id);
        setPendingRecipients(null);
        setShouldNavigateAfterPromptClose(true);
        setShowExtractionPrompt(true);

        toast({
          title: t`Document uploaded`,
          description: t`Your document has been uploaded successfully.`,
          duration: 5000,
        });
      } else {
        await navigate(`${pathPrefix}/${id}/edit`);

        toast({
          title: t`Template uploaded`,
          description: t`Your template has been uploaded successfully.`,
          duration: 5000,
        });
      }
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(err);

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
        .otherwise(() => t`An error occurred while uploading your document.`);

      toast({
        title: t`Upload failed`,
        description: errorMessage,
        variant: 'destructive',
        duration: 7500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onFileDropRejected = (fileRejections: FileRejection[]) => {
    const maxItemsReached = fileRejections.some((fileRejection) =>
      fileRejection.errors.some((error) => error.code === DropzoneErrorCode.TooManyFiles),
    );

    if (maxItemsReached) {
      toast({
        title: t`You cannot upload more than ${maximumEnvelopeItemCount} items per envelope.`,
        duration: 5000,
        variant: 'destructive',
      });

      return;
    }

    toast({
      title: t`Upload failed`,
      description: t`File cannot be larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB`,
      duration: 5000,
      variant: 'destructive',
    });
  };

  const navigateToEnvelopeEditor = () => {
    if (!uploadedDocumentId) {
      return;
    }

    const pathPrefix = formatDocumentsPath(team.url);
    void navigate(`${pathPrefix}/${uploadedDocumentId}/edit`);
  };

  const handleStartRecipientDetection = async () => {
    if (!uploadedDocumentId) {
      return;
    }

    try {
      const recipients = await detectRecipientsInDocument(uploadedDocumentId);

      if (recipients.length === 0) {
        toast({
          title: t`No recipients detected`,
          description: t`You can add recipients manually in the editor`,
          duration: 5000,
        });

        setShouldNavigateAfterPromptClose(true);
        setShowExtractionPrompt(false);
        navigateToEnvelopeEditor();
        return;
      }

      const recipientsWithEmails = ensureRecipientEmails(recipients, uploadedDocumentId);

      setPendingRecipients(recipientsWithEmails);
      setShouldNavigateAfterPromptClose(false);
    } catch (err) {
      const error = AppError.parseError(err);

      // Only show toast if this wasn't a "no recipients found" case
      if (error.code !== 'NO_RECIPIENTS_DETECTED') {
        toast({
          title: t`Failed to analyze recipients`,
          description: error.userMessage || t`You can add recipients manually in the editor`,
          variant: 'destructive',
          duration: 7500,
        });
      }

      throw error;
    }
  };

  const handleSkipRecipientDetection = () => {
    setShouldNavigateAfterPromptClose(true);
    setShowExtractionPrompt(false);
    navigateToEnvelopeEditor();
  };

  const handleRecipientsConfirm = async (recipientsToCreate: RecipientForCreation[]) => {
    if (!uploadedDocumentId) {
      return;
    }

    try {
      await createRecipients({
        envelopeId: uploadedDocumentId,
        data: recipientsToCreate,
      });

      toast({
        title: t`Recipients added`,
        description: t`Successfully detected ${recipientsToCreate.length} ${plural(
          recipientsToCreate.length,
          {
            one: 'recipient',
            other: 'recipients',
          },
        )}`,
        duration: 5000,
      });

      setShowExtractionPrompt(false);
      setPendingRecipients(null);
      navigateToEnvelopeEditor();
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: t`Failed to add recipients`,
        description: error.userMessage || t`Please review the recipients and try again`,
        variant: 'destructive',
        duration: 7500,
      });

      // Error is handled, dialog stays open for retry
    }
  };

  const handleAutoAddFields = async (recipientsToCreate: RecipientForCreation[]) => {
    if (!uploadedDocumentId) {
      return;
    }

    setIsAutoAddingFields(true);

    try {
      await createRecipients({
        envelopeId: uploadedDocumentId,
        data: recipientsToCreate,
      });

      let detectedFields;
      try {
        detectedFields = await detectFieldsInDocument(uploadedDocumentId);
      } catch (error) {
        console.error('Field detection failed:', error);

        toast({
          title: t`Field detection failed`,
          description: t`Recipients added successfully, but field detection encountered an error. You can add fields manually.`,
          variant: 'destructive',
          duration: 7500,
        });

        setShowExtractionPrompt(false);
        setPendingRecipients(null);
        setIsAutoAddingFields(false);

        const pathPrefix = formatDocumentsPath(team.url);
        void navigate(`${pathPrefix}/${uploadedDocumentId}/edit?step=addFields`);
        return;
      }

      if (detectedFields.length > 0) {
        sessionStorage.setItem(
          `autoPlaceFields_${uploadedDocumentId}`,
          JSON.stringify({
            fields: detectedFields,
            recipientCount: recipientsToCreate.length,
          }),
        );
      }

      setShowExtractionPrompt(false);
      setPendingRecipients(null);
      setIsAutoAddingFields(false);

      const pathPrefix = formatDocumentsPath(team.url);
      void navigate(`${pathPrefix}/${uploadedDocumentId}/edit?step=addFields`);
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: t`Failed to add recipients`,
        description: error.userMessage || t`Please try again`,
        variant: 'destructive',
        duration: 7500,
      });

      setIsAutoAddingFields(false);
    }
  };

  const handlePromptDialogOpenChange = (open: boolean) => {
    setShowExtractionPrompt(open);

    if (open) {
      setShouldNavigateAfterPromptClose(true);
      return;
    }

    if (!open && shouldNavigateAfterPromptClose) {
      navigateToEnvelopeEditor();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <DocumentUploadButton
                loading={isLoading}
                disabled={remaining.documents === 0 || !user.emailVerified}
                disabledMessage={disabledMessage}
                onDrop={onFileDrop}
                onDropRejected={onFileDropRejected}
                type={type}
                internalVersion="2"
                maxFiles={maximumEnvelopeItemCount}
              />
            </div>
          </TooltipTrigger>

          {type === EnvelopeType.DOCUMENT &&
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

      <RecipientDetectionPromptDialog
        open={showExtractionPrompt}
        onOpenChange={handlePromptDialogOpenChange}
        onAccept={handleStartRecipientDetection}
        onSkip={handleSkipRecipientDetection}
        recipients={pendingRecipients}
        onRecipientsSubmit={handleRecipientsConfirm}
        onAutoAddFields={handleAutoAddFields}
        isProcessingRecipients={isAutoAddingFields}
      />
    </div>
  );
};
