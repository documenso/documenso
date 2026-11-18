import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import type { EmbedPopupAuthCscOptions } from '@documenso/lib/client-only/hooks/use-embed-popup-auth';
import { openPopupWindow, useEmbedPopupAuth } from '@documenso/lib/client-only/hooks/use-embed-popup-auth';
import { useIsFramed } from '@documenso/lib/client-only/hooks/use-is-framed';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_CONTENT_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientAccessAuth } from '@documenso/lib/types/document-auth';
import { isTspEnvelope } from '@documenso/lib/types/signature-level';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useLingui } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import { useMemo, useState } from 'react';
import { useNavigate, useRevalidator, useSearchParams } from 'react-router';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';

import { DocumentSigningCompleteDialog } from '../document-signing/document-signing-complete-dialog';
import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';
import { EnvelopeSigningCscStatus } from './envelope-signing-csc-status';

type PendingCscSigning = Extract<EmbedPopupAuthCscOptions, { scope: 'credential' }>;

export const EnvelopeSignerCompleteDialog = () => {
  const navigate = useNavigate();
  const analytics = useAnalytics();

  const { t } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const [searchParams] = useSearchParams();

  const {
    isDirectTemplate,
    envelope,
    setShowPendingFieldTooltip,
    recipientFieldsRemaining,
    recipient,
    nextRecipient,
    email,
    fullName,
  } = useRequiredEnvelopeSigningContext();

  const { currentEnvelopeItem, setCurrentEnvelopeItem } = useCurrentEnvelopeRender();

  const { onDocumentCompleted, onDocumentError } = useEmbedSigningContext() || {};

  const isFramed = useIsFramed();

  const { mutateAsync: completeDocument, isPending } = trpc.recipient.completeDocumentWithToken.useMutation();

  const { mutateAsync: createDocumentFromDirectTemplate } =
    trpc.template.createDocumentFromDirectTemplate.useMutation();

  const {
    mutateAsync: signEnvelopeWithCsc,
    isPending: isSigningWithCsc,
    error: cscSignError,
    reset: resetCscSignMutation,
  } = trpc.enterprise.csc.signEnvelope.useMutation();

  // Keeps the trigger locked while the browser navigates to the completed page.
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Set while the embedded CSC popup flow owns the dialog body. Kept across
  // popup errors so a retry can reopen the popup without re-preparing the session.
  const [pendingCsc, setPendingCsc] = useState<PendingCscSigning | null>(null);

  const cscPopupAuth = useEmbedPopupAuth({
    onSuccess: () => void handleCscAuthorised(),
  });

  const isCscPopupBusy = cscPopupAuth.status !== 'idle' && cscPopupAuth.status !== 'error';

  const cscSignErrorCode = cscSignError ? AppError.parseError(cscSignError).code || AppErrorCode.UNKNOWN_ERROR : null;

  const handleDocumentCompleted = async () => {
    setIsRedirecting(true);

    if (onDocumentCompleted) {
      onDocumentCompleted({
        token: recipient.token,
        documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
        recipientId: recipient.id,
        envelopeId: envelope.id,
      });

      await revalidate();

      return;
    }

    if (envelope.documentMeta.redirectUrl) {
      window.location.href = envelope.documentMeta.redirectUrl;
    } else {
      window.location.href = `/sign/${recipient.token}/complete`;
    }
  };

  // Do NOT re-invoke `completeDocumentWithToken` here: for TSP envelopes it
  // re-runs prep, which upserts the `CscSession` and clears the SAD just authorised.
  const handleCscAuthorised = async () => {
    if (!pendingCsc) {
      return;
    }

    try {
      await signEnvelopeWithCsc({
        sessionId: pendingCsc.sessionId,
        recipientToken: recipient.token,
      });

      await handleDocumentCompleted();
    } catch (err) {
      analytics.captureException(err, {
        source: 'signing',
        location: 'complete_document_csc',
        recipientId: recipient.id,
        envelopeId: envelope.id,
      });

      onDocumentError?.();
    }
  };

  const startCscPopupFlow = (csc: PendingCscSigning, popup: Window | null = null) => {
    setPendingCsc(csc);
    resetCscSignMutation();

    cscPopupAuth.reset();
    cscPopupAuth.start('csc', { csc, popup });
  };

  const onCscRetryClick = () => {
    if (!pendingCsc) {
      return;
    }

    startCscPopupFlow(pendingCsc);
  };

  const resetCscFlow = () => {
    cscPopupAuth.cancel();
    resetCscSignMutation();
    setPendingCsc(null);
  };

  const onDialogOpenChange = (open: boolean) => {
    if (open) {
      return;
    }

    resetCscFlow();
  };

  const handleOnNextFieldClick = () => {
    const nextField = recipientFieldsRemaining[0];

    if (!nextField) {
      setShowPendingFieldTooltip(false);
      return;
    }

    const isEnvelopeItemSwitch = nextField.envelopeItemId !== currentEnvelopeItem?.id;

    if (isEnvelopeItemSwitch) {
      setCurrentEnvelopeItem(nextField.envelopeItemId);
    }

    setShowPendingFieldTooltip(true);

    setTimeout(
      () => {
        const fieldTooltip = document.querySelector(`#field-tooltip`);

        if (fieldTooltip) {
          fieldTooltip.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Tooltip not in DOM (page virtualized away) — signal the PDF viewer
          // to scroll to the correct page via the data attribute.
          const pdfContent = document.querySelector(PDF_VIEWER_CONTENT_SELECTOR);

          if (pdfContent) {
            pdfContent.setAttribute('data-scroll-to-page', String(nextField.page));
          }
        }
      },
      isEnvelopeItemSwitch ? 150 : 50,
    );
  };

  const handleOnCompleteClick = async (
    nextSigner?: { name: string; email: string },
    accessAuthOptions?: TRecipientAccessAuth,
    recipientDetails?: { name: string; email: string },
  ) => {
    // Preparing the signing session can outlive the click's user activation,
    // so open the popup now and hand it to `start` later.
    const preOpenedPopup = isFramed && isTspEnvelope(envelope) ? openPopupWindow() : null;

    const closePreOpenedPopup = () => {
      if (preOpenedPopup && !preOpenedPopup.closed) {
        preOpenedPopup.close();
      }
    };

    try {
      const result = await completeDocument({
        token: recipient.token,
        documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
        accessAuthOptions,
        recipientOverride: recipientDetails,
        ...(nextSigner?.email && nextSigner?.name ? { nextSigner } : {}),
      });

      // TSP envelopes can't be completed via the SES path; the mutation returns
      // a credential-scope OAuth URL the recipient must follow to acquire a SAD
      // before the sync sign mutation can run. Short-circuit here so the
      // analytics / completion handlers don't run with a still-unsigned doc.
      if (result.status === 'REDIRECT') {
        if (!isFramed) {
          closePreOpenedPopup();

          window.location.href = result.redirectUrl;
          return;
        }

        startCscPopupFlow({ scope: 'credential', token: recipient.token, sessionId: result.sessionId }, preOpenedPopup);

        return;
      }

      closePreOpenedPopup();

      // The document was already completed by an earlier request (retry,
      // stale tab or concurrent submission). Let the user know this click
      // didn't complete the document, then continue to the completed page.
      if (result.status === 'ALREADY_SIGNED') {
        toast({
          title: t`Document already signed`,
          description: t`This document was already signed and no further action was taken.`,
        });
      }

      await handleDocumentCompleted();
    } catch (err) {
      closePreOpenedPopup();

      const error = AppError.parseError(err);

      const isTwoFactorRetry =
        error.code === AppErrorCode.TWO_FACTOR_AUTH_FAILED ||
        (error.code === AppErrorCode.TOO_MANY_REQUESTS && Boolean(accessAuthOptions));

      if (!isTwoFactorRetry) {
        analytics.captureException(err, {
          source: 'signing',
          location: 'complete_document',
          recipientId: recipient.id,
          envelopeId: envelope.id,
        });

        onDocumentError?.();
      }

      // Rethrow so DocumentSigningCompleteDialog can handle 2FA retries and
      // toast a specific completion error message.
      throw err;
    }
  };

  /**
   * Direct template completion flow.
   */
  const handleDirectTemplateCompleteClick = async (
    nextSigner?: { name: string; email: string },
    accessAuthOptions?: TRecipientAccessAuth,
    recipientDetails?: { name: string; email: string },
  ) => {
    try {
      let directTemplateExternalId = searchParams?.get('externalId') || undefined;

      if (directTemplateExternalId) {
        directTemplateExternalId = decodeURIComponent(directTemplateExternalId);
      }

      if (!recipient.directToken) {
        throw new Error('Recipient direct token is required');
      }

      const { token } = await createDocumentFromDirectTemplate({
        directTemplateToken: recipient.directToken, // The direct template token is inserted into the recipient token for ease of use.
        directTemplateExternalId,
        directRecipientName: recipientDetails?.name || fullName,
        directRecipientEmail: recipientDetails?.email || email,
        templateUpdatedAt: envelope.updatedAt,
        signedFieldValues: recipient.fields.map((field) => {
          let value = field.customText;
          let isBase64 = false;

          if (field.type === FieldType.SIGNATURE && field.signature) {
            value = field.signature.signatureImageAsBase64 || field.signature.typedSignature || '';
            isBase64 = isBase64Image(value);
          }

          return {
            token: '',
            fieldId: field.id,
            value,
            isBase64,
          };
        }),
        nextSigner,
      });

      const redirectUrl = envelope.documentMeta.redirectUrl;

      if (onDocumentCompleted) {
        await navigate({
          pathname: `/embed/sign/${token}`,
          search: window.location.search,
          hash: window.location.hash,
        });

        return;
      }

      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        window.location.href = `/sign/${token}/complete`;
      }
    } catch (err) {
      console.log('err', err);

      analytics.captureException(err, {
        source: 'signing',
        location: 'complete_document_next_signer',
        recipientId: recipient.id,
        envelopeId: envelope.id,
      });

      onDocumentError?.();

      // Rethrow so DocumentSigningCompleteDialog can toast a specific
      // completion error message.
      throw err;
    }
  };

  const recipientPayload = useMemo(() => {
    if (!isDirectTemplate) {
      return {
        name:
          recipient.name ||
          fullName ||
          recipient.fields.find((field) => field.type === FieldType.NAME)?.customText ||
          '',
        email:
          recipient.email ||
          email ||
          recipient.fields.find((field) => field.type === FieldType.EMAIL)?.customText ||
          '',
      };
    }

    return {
      name: fullName,
      email: email,
    };
  }, [email, fullName, isDirectTemplate, recipient.email, recipient.name, recipient.fields]);

  const isSubmitting = isPending || isSigningWithCsc || isCscPopupBusy || isRedirecting;

  return (
    <DocumentSigningCompleteDialog
      isSubmitting={isSubmitting}
      onOpenChange={onDialogOpenChange}
      recipientPayload={recipientPayload}
      onSignatureComplete={isDirectTemplate ? handleDirectTemplateCompleteClick : handleOnCompleteClick}
      documentTitle={envelope.title}
      fields={recipientFieldsRemaining}
      fieldsValidated={handleOnNextFieldClick}
      recipient={recipient}
      allowDictateNextSigner={Boolean(nextRecipient && envelope.documentMeta.allowDictateNextSigner)}
      disableNameInput={!isDirectTemplate && recipient.name !== ''}
      defaultNextSigner={nextRecipient ? { name: nextRecipient.name, email: nextRecipient.email } : undefined}
      buttonSize="sm"
      position="center"
    >
      {pendingCsc && (
        <EnvelopeSigningCscStatus
          popupAuth={cscPopupAuth}
          isSigning={isSigningWithCsc || isRedirecting}
          signErrorCode={cscSignErrorCode}
          onCancel={resetCscFlow}
          onRetry={onCscRetryClick}
        />
      )}
    </DocumentSigningCompleteDialog>
  );
};
