import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from 'react-router';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import type { TRecipientAccessAuth } from '@documenso/lib/types/document-auth';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Separator } from '@documenso/ui/primitives/separator';

import { BrandingLogo } from '~/components/general/branding-logo';

import { DocumentSigningCompleteDialog } from '../document-signing/document-signing-complete-dialog';
import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

export const EnvelopeSignerHeader = () => {
  const { t } = useLingui();

  const navigate = useNavigate();
  const analytics = useAnalytics();

  const { envelope, setShowPendingFieldTooltip, recipientFieldsRemaining, recipient } =
    useRequiredEnvelopeSigningContext();

  const { currentEnvelopeItem, setCurrentEnvelopeItem } = useCurrentEnvelopeRender();

  const {
    mutateAsync: completeDocument,
    isPending,
    isSuccess,
  } = trpc.recipient.completeDocumentWithToken.useMutation();

  const handleOnNextFieldClick = () => {
    const nextField = recipientFieldsRemaining[0];

    if (!nextField) {
      setShowPendingFieldTooltip(false);
      return;
    }

    if (nextField.envelopeItemId !== currentEnvelopeItem?.id) {
      setCurrentEnvelopeItem(nextField.envelopeItemId);
    }

    const fieldTooltip = document.querySelector(`#field-tooltip`);

    if (fieldTooltip) {
      fieldTooltip.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setShowPendingFieldTooltip(true);
  };

  const handleOnCompleteClick = async (
    nextSigner?: { name: string; email: string },
    accessAuthOptions?: TRecipientAccessAuth,
  ) => {
    const payload = {
      token: recipient.token,
      documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
      authOptions: accessAuthOptions,
      ...(nextSigner?.email && nextSigner?.name ? { nextSigner } : {}),
    };

    await completeDocument(payload);

    analytics.capture('App: Recipient has completed signing', {
      signerId: recipient.id,
      documentId: envelope.id,
      timestamp: new Date().toISOString(),
    });

    if (envelope.documentMeta.redirectUrl) {
      window.location.href = envelope.documentMeta.redirectUrl;
    } else {
      await navigate(`/sign/${recipient.token}/complete`);
    }
  };

  return (
    <nav className="w-full border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/">
            <BrandingLogo className="h-6 w-auto" />
          </Link>
          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center space-x-2">
            <h1 className="whitespace-nowrap text-sm font-medium text-gray-600">
              {envelope.title}
            </h1>

            <Badge variant="secondary">
              <Trans>Approver</Trans>
            </Badge>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <p className="text-muted-foreground mr-2 flex-shrink-0 text-sm">
            <Plural
              one="1 Field Remaining"
              other="# Fields Remaining"
              value={recipientFieldsRemaining.length}
            />
          </p>

          <DocumentSigningCompleteDialog
            isSubmitting={isPending}
            onSignatureComplete={handleOnCompleteClick}
            documentTitle={envelope.title}
            fields={recipientFieldsRemaining}
            fieldsValidated={handleOnNextFieldClick}
            recipient={recipient}
            // Todo: Envelopes
            allowDictateNextSigner={envelope.documentMeta.allowDictateNextSigner}
            // defaultNextSigner={
            //   nextRecipient
            //     ? { name: nextRecipient.name, email: nextRecipient.email }
            //     : undefined
            // }
            // Todo: Envelopes - use
            // buttonSize="sm"
          />
        </div>
      </div>
    </nav>
  );
};
