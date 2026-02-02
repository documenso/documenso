import { useEffect, useLayoutEffect, useState } from 'react';

import { SigningStatus } from '@prisma/client';
import { useRevalidator } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getOrganisationClaimByTeamId } from '@documenso/lib/server-only/organisation/get-organisation-claims';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';

import { BrandingLogo } from '~/components/general/branding-logo';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { DocumentSigningRecipientProvider } from '~/components/general/document-signing/document-signing-recipient-provider';
import { ZSignDocumentEmbedDataSchema } from '~/types/embed-document-sign-schema';
import { injectCss } from '~/utils/css-vars';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import { MultiSignDocumentList } from '../../../../components/embed/multisign/multi-sign-document-list';
import { MultiSignDocumentSigningView } from '../../../../components/embed/multisign/multi-sign-document-signing-view';
import type { Route } from './+types/_index';

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getOptionalSession(request);

  const url = new URL(request.url);

  const tokens = url.searchParams.getAll('token');

  const envelopes = await Promise.all(
    tokens.map(async (token) => {
      const document = await getDocumentAndSenderByToken({
        token,
      });

      const recipient = await getRecipientByToken({ token });

      return { document, recipient };
    }),
  );

  // Check the first envelope for whitelabelling settings (assuming all docs are from same team)
  const firstDocument = envelopes[0]?.document;

  if (!firstDocument) {
    return superLoaderJson({
      envelopes,
      user,
      hidePoweredBy: false,
      allowWhitelabelling: false,
    });
  }

  const organisationClaim = await getOrganisationClaimByTeamId({ teamId: firstDocument.teamId });

  const allowWhitelabelling = organisationClaim.flags.embedSigningWhiteLabel;
  const hidePoweredBy = organisationClaim.flags.hidePoweredBy;

  return superLoaderJson({
    envelopes,
    user,
    hidePoweredBy,
    allowWhitelabelling,
  });
}

export default function MultisignPage() {
  const { envelopes, user, hidePoweredBy, allowWhitelabelling } =
    useSuperLoaderData<typeof loader>();

  const revalidator = useRevalidator();

  const [selectedDocument, setSelectedDocument] = useState<
    (typeof envelopes)[number]['document'] | null
  >(null);

  // Additional state for embed functionality
  const [hasFinishedInit, setHasFinishedInit] = useState(false);
  const [isNameLocked, setIsNameLocked] = useState(false);
  const [allowDocumentRejection, setAllowDocumentRejection] = useState(false);
  const [showOtherRecipientsCompletedFields, setShowOtherRecipientsCompletedFields] =
    useState(false);
  const [embedFullName, setEmbedFullName] = useState('');

  // Check if all documents are completed
  const isCompleted = envelopes.every(
    (envelope) => envelope.recipient.signingStatus === SigningStatus.SIGNED,
  );

  const selectedRecipient = selectedDocument
    ? envelopes.find((e) => e.document.id === selectedDocument.id)?.recipient
    : null;

  const onSelectDocument = (document: (typeof envelopes)[number]['document']) => {
    setSelectedDocument(document);
  };

  const onBackToDocumentList = () => {
    setSelectedDocument(null);
    // Revalidate to fetch fresh data when returning to document list
    void revalidator.revalidate();
  };

  const onDocumentCompleted = (data: {
    token: string;
    documentId: number;
    recipientId: number;
  }) => {
    // Send postMessage for individual document completion
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'document-completed',
          data: {
            token: data.token,
            documentId: data.documentId,
            recipientId: data.recipientId,
          },
        },
        '*',
      );
    }
  };

  const onDocumentRejected = (data: {
    token: string;
    documentId: number;
    recipientId: number;
    reason: string;
  }) => {
    // Send postMessage for document rejection
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'document-rejected',
          data: {
            token: data.token,
            documentId: data.documentId,
            recipientId: data.recipientId,
            reason: data.reason,
          },
        },
        '*',
      );
    }
  };

  const onDocumentError = () => {
    // Send postMessage for document error
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
    // Send postMessage when document is ready
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

  const onAllDocumentsCompleted = () => {
    // Send postMessage for all documents completion
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'all-documents-completed',
          data: {
            documents: envelopes.map((envelope) => ({
              token: envelope.recipient.token,
              documentId: envelope.document.id,
              recipientId: envelope.recipient.id,
              action:
                envelope.recipient.signingStatus === SigningStatus.SIGNED
                  ? 'document-completed'
                  : 'document-rejected',
              reason:
                envelope.recipient.signingStatus === SigningStatus.REJECTED
                  ? envelope.recipient.rejectionReason
                  : undefined,
            })),
          },
        },
        '*',
      );
    }
  };

  useEffect(() => {
    if (
      envelopes.every((envelope) => envelope.recipient.signingStatus !== SigningStatus.NOT_SIGNED)
    ) {
      onAllDocumentsCompleted();
    }
  }, [envelopes]);

  useLayoutEffect(() => {
    const hash = window.location.hash.slice(1);

    try {
      const data = ZSignDocumentEmbedDataSchema.parse(JSON.parse(decodeURIComponent(atob(hash))));

      if (!isCompleted && data.name) {
        setEmbedFullName(data.name);
      }

      // Since a recipient can be provided a name we can lock it without requiring
      // a to be provided by the parent application, unlike direct templates.
      setIsNameLocked(!!data.lockName);
      setAllowDocumentRejection(!!data.allowDocumentRejection);
      setShowOtherRecipientsCompletedFields(!!data.showOtherRecipientsCompletedFields);

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

    // !: While the two setters are stable we still want to ensure we're avoiding
    // !: re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If a document is selected, show the signing view
  if (selectedDocument && selectedRecipient) {
    // Determine the full name to use - prioritize embed data, then user name, then recipient name
    const fullNameToUse =
      embedFullName ||
      (user?.email === selectedRecipient.email ? user?.name : selectedRecipient.name) ||
      '';

    return (
      <div className="p-4">
        <DocumentSigningProvider
          email={selectedRecipient.email}
          fullName={fullNameToUse}
          signature={user?.email === selectedRecipient.email ? user?.signature : undefined}
          typedSignatureEnabled={selectedDocument.documentMeta?.typedSignatureEnabled}
          uploadSignatureEnabled={selectedDocument.documentMeta?.uploadSignatureEnabled}
          drawSignatureEnabled={selectedDocument.documentMeta?.drawSignatureEnabled}
        >
          <DocumentSigningAuthProvider
            documentAuthOptions={selectedDocument.authOptions}
            recipient={selectedRecipient}
            user={user}
          >
            <DocumentSigningRecipientProvider recipient={selectedRecipient} targetSigner={null}>
              <MultiSignDocumentSigningView
                token={selectedRecipient.token}
                recipientId={selectedRecipient.id}
                onBack={onBackToDocumentList}
                onDocumentCompleted={onDocumentCompleted}
                onDocumentRejected={onDocumentRejected}
                onDocumentError={onDocumentError}
                onDocumentReady={onDocumentReady}
                isNameLocked={isNameLocked}
              />
            </DocumentSigningRecipientProvider>
          </DocumentSigningAuthProvider>
        </DocumentSigningProvider>

        {!hidePoweredBy && (
          <div className="bg-primary text-primary-foreground fixed bottom-0 left-0 z-40 rounded-tr px-2 py-1 text-xs font-medium opacity-60 hover:opacity-100">
            <span>Powered by</span>
            <BrandingLogo className="ml-2 inline-block h-[14px]" />
          </div>
        )}
      </div>
    );
  }

  // Otherwise, show the document list
  return (
    <div className="p-4">
      <MultiSignDocumentList envelopes={envelopes} onDocumentSelect={onSelectDocument} />

      {!hidePoweredBy && (
        <div className="bg-primary text-primary-foreground fixed bottom-0 left-0 z-40 rounded-tr px-2 py-1 text-xs font-medium opacity-60 hover:opacity-100">
          <span>Powered by</span>
          <BrandingLogo className="ml-2 inline-block h-[14px]" />
        </div>
      )}
    </div>
  );
}
