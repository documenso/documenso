import { Trans } from '@lingui/react/macro';
import { DocumentSigningOrder, DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { Clock8 } from 'lucide-react';
import { Link, redirect } from 'react-router';
import { getOptionalLoaderContext } from 'server/utils/get-loader-session';

import signingCelebration from '@documenso/assets/images/signing-celebration.png';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { isRecipientAuthorized } from '@documenso/lib/server-only/document/is-recipient-authorized';
import { viewedDocument } from '@documenso/lib/server-only/document/viewed-document';
import { getCompletedFieldsForToken } from '@documenso/lib/server-only/field/get-completed-fields-for-token';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getIsRecipientsTurnToSign } from '@documenso/lib/server-only/recipient/get-is-recipient-turn';
import { getNextPendingRecipient } from '@documenso/lib/server-only/recipient/get-next-pending-recipient';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getRecipientSignatures } from '@documenso/lib/server-only/recipient/get-recipient-signatures';
import { getRecipientsForAssistant } from '@documenso/lib/server-only/recipient/get-recipients-for-assistant';
import { getTeamSettings } from '@documenso/lib/server-only/team/get-team-settings';
import { getUserByEmail } from '@documenso/lib/server-only/user/get-user-by-email';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { SigningCard3D } from '@documenso/ui/components/signing-card';

import { DocumentSigningAuthPageView } from '~/components/general/document-signing/document-signing-auth-page';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningPageView } from '~/components/general/document-signing/document-signing-page-view';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/_index';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { requestMetadata } = getOptionalLoaderContext();

  const { user } = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    throw new Response('Not Found', { status: 404 });
  }

  const [document, recipient, fields, completedFields] = await Promise.all([
    getDocumentAndSenderByToken({
      token,
      userId: user?.id,
      requireAccessAuth: false,
    }).catch(() => null),
    getRecipientByToken({ token }).catch(() => null),
    getFieldsForToken({ token }),
    getCompletedFieldsForToken({ token }),
  ]);

  if (
    !document ||
    !document.documentData ||
    !recipient ||
    document.status === DocumentStatus.DRAFT
  ) {
    throw new Response('Not Found', { status: 404 });
  }

  const recipientWithFields = { ...recipient, fields };

  const isRecipientsTurn = await getIsRecipientsTurnToSign({ token });

  if (!isRecipientsTurn) {
    throw redirect(`/sign/${token}/waiting`);
  }

  const allRecipients =
    recipient.role === RecipientRole.ASSISTANT
      ? await getRecipientsForAssistant({
          token,
        })
      : [recipient];

  if (
    document.documentMeta?.signingOrder === DocumentSigningOrder.SEQUENTIAL &&
    recipient.role !== RecipientRole.ASSISTANT
  ) {
    const nextPendingRecipient = await getNextPendingRecipient({
      documentId: document.id,
      currentRecipientId: recipient.id,
    });

    if (nextPendingRecipient) {
      allRecipients.push({
        ...nextPendingRecipient,
        fields: [],
      });
    }
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipient.authOptions,
  });

  const isDocumentAccessValid = await isRecipientAuthorized({
    type: 'ACCESS',
    documentAuthOptions: document.authOptions,
    recipient,
    userId: user?.id,
  });

  let recipientHasAccount: boolean | null = null;

  if (!isDocumentAccessValid) {
    recipientHasAccount = await getUserByEmail({ email: recipient.email })
      .then((user) => !!user)
      .catch(() => false);

    return superLoaderJson({
      isDocumentAccessValid: false,
      recipientEmail: recipient.email,
      recipientHasAccount,
    } as const);
  }

  await viewedDocument({
    token,
    requestMetadata,
    recipientAccessAuth: derivedRecipientAccessAuth,
  }).catch(() => null);

  const { documentMeta } = document;

  if (recipient.signingStatus === SigningStatus.REJECTED) {
    throw redirect(`/sign/${token}/rejected`);
  }

  if (
    document.status === DocumentStatus.COMPLETED ||
    recipient.signingStatus === SigningStatus.SIGNED
  ) {
    throw redirect(documentMeta?.redirectUrl || `/sign/${token}/complete`);
  }

  const [recipientSignature] = await getRecipientSignatures({ recipientId: recipient.id });

  const settings = await getTeamSettings({ teamId: document.teamId });

  return superLoaderJson({
    isDocumentAccessValid: true,
    document,
    fields,
    recipient,
    recipientWithFields,
    allRecipients,
    completedFields,
    recipientSignature,
    isRecipientsTurn,
    includeSenderDetails: settings.includeSenderDetails,
  } as const);
}

export default function SigningPage() {
  const data = useSuperLoaderData<typeof loader>();

  const { sessionData } = useOptionalSession();
  const user = sessionData?.user;

  if (!data.isDocumentAccessValid) {
    return (
      <DocumentSigningAuthPageView
        email={data.recipientEmail}
        emailHasAccount={!!data.recipientHasAccount}
      />
    );
  }

  const {
    document,
    fields,
    recipient,
    completedFields,
    recipientSignature,
    isRecipientsTurn,
    allRecipients,
    includeSenderDetails,
    recipientWithFields,
  } = data;

  if (document.deletedAt || document.status === DocumentStatus.REJECTED) {
    return (
      <div className="-mx-4 flex max-w-[100vw] flex-col items-center overflow-x-hidden px-4 pt-16 md:-mx-8 md:px-8 lg:pt-16 xl:pt-24">
        <SigningCard3D
          name={recipient.name}
          signature={recipientSignature}
          signingCelebrationImage={signingCelebration}
        />

        <div className="relative mt-2 flex w-full flex-col items-center">
          <div className="mt-8 flex items-center text-center text-red-600">
            <Clock8 className="mr-2 h-5 w-5" />
            <span className="text-sm">
              <Trans>Document Cancelled</Trans>
            </span>
          </div>

          <h2 className="mt-6 max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
            <Trans>
              <span className="mt-1.5 block">"{document.title}"</span>
              is no longer available to sign
            </Trans>
          </h2>

          <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
            <Trans>This document has been cancelled by the owner.</Trans>
          </p>

          {user ? (
            <Link to="/" className="text-documenso-700 hover:text-documenso-600 mt-36">
              <Trans>Go Back Home</Trans>
            </Link>
          ) : (
            <p className="text-muted-foreground/60 mt-36 text-sm">
              <Trans>
                Want to send slick signing links like this one?{' '}
                <Link
                  to="https://documenso.com"
                  className="text-documenso-700 hover:text-documenso-600"
                >
                  Check out Documenso.
                </Link>
              </Trans>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <DocumentSigningProvider
      email={recipient.email}
      fullName={user?.email === recipient.email ? user?.name : recipient.name}
      signature={user?.email === recipient.email ? user?.signature : undefined}
      typedSignatureEnabled={document.documentMeta?.typedSignatureEnabled}
      uploadSignatureEnabled={document.documentMeta?.uploadSignatureEnabled}
      drawSignatureEnabled={document.documentMeta?.drawSignatureEnabled}
    >
      <DocumentSigningAuthProvider
        documentAuthOptions={document.authOptions}
        recipient={recipient}
        user={user}
      >
        <DocumentSigningPageView
          recipient={recipientWithFields}
          document={document}
          fields={fields}
          completedFields={completedFields}
          isRecipientsTurn={isRecipientsTurn}
          allRecipients={allRecipients}
          includeSenderDetails={includeSenderDetails}
        />
      </DocumentSigningAuthProvider>
    </DocumentSigningProvider>
  );
}
