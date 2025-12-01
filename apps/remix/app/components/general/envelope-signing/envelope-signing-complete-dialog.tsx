import { useMemo } from 'react';

import { useLingui } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import { useNavigate, useRevalidator, useSearchParams } from 'react-router';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientAccessAuth } from '@documenso/lib/types/document-auth';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';

import { DocumentSigningCompleteDialog } from '../document-signing/document-signing-complete-dialog';
import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

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

  const { mutateAsync: completeDocument, isPending } =
    trpc.recipient.completeDocumentWithToken.useMutation();

  const { mutateAsync: createDocumentFromDirectTemplate } =
    trpc.template.createDocumentFromDirectTemplate.useMutation();

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
        }
      },
      isEnvelopeItemSwitch ? 150 : 50,
    );
  };

  const handleOnCompleteClick = async (
    nextSigner?: { name: string; email: string },
    accessAuthOptions?: TRecipientAccessAuth,
  ) => {
    try {
      await completeDocument({
        token: recipient.token,
        documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
        accessAuthOptions,
        ...(nextSigner?.email && nextSigner?.name ? { nextSigner } : {}),
      });

      analytics.capture('App: Recipient has completed signing', {
        signerId: recipient.id,
        documentId: envelope.id,
        timestamp: new Date().toISOString(),
      });

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
        await navigate(`/sign/${recipient.token}/complete`);
      }
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code !== AppErrorCode.TWO_FACTOR_AUTH_FAILED) {
        toast({
          title: t`Something went wrong`,
          description: t`We were unable to submit this document at this time. Please try again later.`,
          variant: 'destructive',
        });

        onDocumentError?.();
      }

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
        await navigate(`/sign/${token}/complete`);
      }
    } catch (err) {
      console.log('err', err);
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to submit this document at this time. Please try again later.`,
        variant: 'destructive',
      });

      onDocumentError?.();

      throw err;
    }
  };

  const directTemplatePayload = useMemo(() => {
    if (!isDirectTemplate) {
      return;
    }

    return {
      name: fullName,
      email: email,
    };
  }, [email, fullName, isDirectTemplate]);

  return (
    <DocumentSigningCompleteDialog
      isSubmitting={isPending}
      directTemplatePayload={directTemplatePayload}
      onSignatureComplete={
        isDirectTemplate ? handleDirectTemplateCompleteClick : handleOnCompleteClick
      }
      documentTitle={envelope.title}
      fields={recipientFieldsRemaining}
      fieldsValidated={handleOnNextFieldClick}
      recipient={recipient}
      allowDictateNextSigner={Boolean(
        nextRecipient && envelope.documentMeta.allowDictateNextSigner,
      )}
      defaultNextSigner={
        nextRecipient ? { name: nextRecipient.name, email: nextRecipient.email } : undefined
      }
      buttonSize="sm"
      position="center"
    />
  );
};
