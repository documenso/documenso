import { useEffect, useLayoutEffect, useState } from 'react';

import { useLingui } from '@lingui/react';

import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';

import { ZSignDocumentEmbedDataSchema } from '~/types/embed-document-sign-schema';
import { injectCss } from '~/utils/css-vars';

import { DocumentSigningPageViewV2 } from '../general/document-signing/document-signing-page-view-v2';
import { useRequiredEnvelopeSigningContext } from '../general/document-signing/envelope-signing-provider';
import { EmbedClientLoading } from './embed-client-loading';
import { EmbedDocumentCompleted } from './embed-document-completed';
import { EmbedDocumentRejected } from './embed-document-rejected';
import { EmbedSigningProvider } from './embed-signing-context';

export type EmbedSignDocumentV2ClientPageProps = {
  hidePoweredBy?: boolean;
  allowWhitelabelling?: boolean;
};

export const EmbedSignDocumentV2ClientPage = ({
  hidePoweredBy = false,
  allowWhitelabelling = false,
}: EmbedSignDocumentV2ClientPageProps) => {
  const { _ } = useLingui();

  const { envelope, recipient, envelopeData, setFullName, fullName } =
    useRequiredEnvelopeSigningContext();

  const { isCompleted, isRejected, recipientSignature } = envelopeData;

  // !: Not used at the moment, may be removed in the future.
  // const [hasDocumentLoaded, setHasDocumentLoaded] = useState(false);
  const [hasFinishedInit, setHasFinishedInit] = useState(false);
  const [allowDocumentRejection, setAllowDocumentRejection] = useState(false);
  const [isNameLocked, setIsNameLocked] = useState(false);

  const onDocumentCompleted = (data: {
    token: string;
    documentId: number;
    envelopeId: string;
    recipientId: number;
  }) => {
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'document-completed',
          data,
        },
        '*',
      );
    }
  };

  const onDocumentError = () => {
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'document-error',
          data: null,
        },
        '*',
      );
    }
  };

  const onDocumentReady = () => {
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'document-ready',
          data: null,
        },
        '*',
      );
    }
  };

  const onFieldSigned = (data: { fieldId?: number; value?: string; isBase64?: boolean }) => {
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'field-signed',
          data,
        },
        '*',
      );
    }
  };

  const onFieldUnsigned = (data: { fieldId?: number }) => {
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'field-unsigned',
          data,
        },
        '*',
      );
    }
  };

  const onDocumentRejected = (data: {
    token: string;
    documentId: number;
    envelopeId: string;
    recipientId: number;
    reason?: string;
  }) => {
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'document-rejected',
          data,
        },
        '*',
      );
    }
  };

  useLayoutEffect(() => {
    const hash = window.location.hash.slice(1);

    try {
      const data = ZSignDocumentEmbedDataSchema.parse(JSON.parse(decodeURIComponent(atob(hash))));

      if (!isCompleted && data.name) {
        setFullName(data.name);
      }

      // Since a recipient can be provided a name we can lock it without requiring
      // a to be provided by the parent application, unlike direct templates.
      setIsNameLocked(!!data.lockName);
      setAllowDocumentRejection(!!data.allowDocumentRejection);

      if (data.darkModeDisabled) {
        document.documentElement.classList.add('dark-mode-disabled');
      }

      if (allowWhitelabelling) {
        injectCss({
          css: data.css,
          cssVars: data.cssVars,
        });
      }
    } catch (err) {
      console.error(err);
    }

    setHasFinishedInit(true);

    // !: While the setters are stable we still want to ensure we're avoiding
    // !: re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowWhitelabelling]);

  useEffect(() => {
    if (hasFinishedInit) {
      onDocumentReady();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFinishedInit]);

  // Listen for document completion events from the envelope signing context
  useEffect(() => {
    if (isCompleted) {
      onDocumentCompleted({
        token: recipient.token,
        envelopeId: envelope.id,
        documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
        recipientId: recipient.id,
      });
    }
  }, [isCompleted, envelope.id, recipient.id, recipient.token]);

  // Listen for document rejection events
  useEffect(() => {
    if (isRejected) {
      onDocumentRejected({
        token: recipient.token,
        envelopeId: envelope.id,
        documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
        recipientId: recipient.id,
      });
    }
  }, [isRejected, envelope.id, recipient.id, recipient.token]);

  if (isRejected) {
    return <EmbedDocumentRejected />;
  }

  if (isCompleted) {
    return (
      <EmbedDocumentCompleted
        name={fullName}
        signature={
          recipientSignature
            ? {
                id: 1,
                fieldId: 1,
                recipientId: recipient.id,
                created: new Date(),
                signatureImageAsBase64: recipientSignature.signatureImageAsBase64,
                typedSignature: recipientSignature.typedSignature,
              }
            : undefined
        }
      />
    );
  }

  return (
    <EmbedSigningProvider
      isNameLocked={isNameLocked}
      hidePoweredBy={hidePoweredBy}
      allowDocumentRejection={allowDocumentRejection}
      onDocumentCompleted={onDocumentCompleted}
      onDocumentError={onDocumentError}
      onDocumentRejected={onDocumentRejected}
      onDocumentReady={onDocumentReady}
      onFieldSigned={onFieldSigned}
      onFieldUnsigned={onFieldUnsigned}
    >
      <div className="embed--Root relative">
        {!hasFinishedInit && <EmbedClientLoading />}

        <DocumentSigningPageViewV2 />
      </div>
    </EmbedSigningProvider>
  );
};
