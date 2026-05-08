import { Trans } from '@lingui/react/macro';
import { DocumentSigningOrder, DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { Clock8 } from 'lucide-react';
import { Link, redirect } from 'react-router';
import { getOptionalLoaderContext } from 'server/utils/get-loader-session';
import { match } from 'ts-pattern';

import signingCelebration from '@documenso/assets/images/signing-celebration.png';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { viewedDocument } from '@documenso/lib/server-only/document/viewed-document';
import { getEnvelopeForRecipientSigning } from '@documenso/lib/server-only/envelope/get-envelope-for-recipient-signing';
import { getEnvelopeRequiredAccessData } from '@documenso/lib/server-only/envelope/get-envelope-required-access-data';
import { getCompletedFieldsForToken } from '@documenso/lib/server-only/field/get-completed-fields-for-token';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getIsRecipientsTurnToSign } from '@documenso/lib/server-only/recipient/get-is-recipient-turn';
import { getNextPendingRecipient } from '@documenso/lib/server-only/recipient/get-next-pending-recipient';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getRecipientSignatures } from '@documenso/lib/server-only/recipient/get-recipient-signatures';
import { getRecipientsForAssistant } from '@documenso/lib/server-only/recipient/get-recipients-for-assistant';
import { getTeamSettings } from '@documenso/lib/server-only/team/get-team-settings';
import { getUserByEmail } from '@documenso/lib/server-only/user/get-user-by-email';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { isRecipientExpired } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { SigningCard3D } from '@documenso/ui/components/signing-card';

import { Header as AuthenticatedHeader } from '~/components/general/app-header';
import { DocumentSigningAuthPageView } from '~/components/general/document-signing/document-signing-auth-page';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningPageViewV1 } from '~/components/general/document-signing/document-signing-page-view-v1';
import { DocumentSigningPageViewV2 } from '~/components/general/document-signing/document-signing-page-view-v2';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { EnvelopeSigningProvider } from '~/components/general/document-signing/envelope-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/_index';

const handleV1Loader = async ({ params, request }: Route.LoaderArgs) => {
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

  if (!document || !document.documentData || !recipient || document.status === DocumentStatus.DRAFT) {
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

  const isAccessAuthValid = derivedRecipientAccessAuth.every((accesssAuth) =>
    match(accesssAuth)
      .with(DocumentAccessAuth.ACCOUNT, () => user && user.email === recipient.email)
      .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => true) // Allow without account requirement
      .exhaustive(),
  );

  let recipientHasAccount: boolean | null = null;

  if (!isAccessAuthValid) {
    recipientHasAccount = await getUserByEmail({ email: recipient.email })
      .then((user) => !!user)
      .catch(() => false);

    return {
      isDocumentAccessValid: false,
      recipientEmail: recipient.email,
      recipientHasAccount,
    } as const;
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

  if (recipient.signingStatus === SigningStatus.SIGNED) {
    throw redirect(`/sign/${token}/complete`);
  }

  if (isRecipientExpired(recipient)) {
    throw redirect(`/sign/${token}/expired`);
  }

  const recipientSignatures = await getRecipientSignatures({
    recipientId: recipient.id,
  });

  const teamSettings = await getTeamSettings({
    teamId: document.team?.id,
  });

  const signatures = recipientSignatures.map((signature) => signature.Signature);

  return superLoaderJson({
    recipients: allRecipients,
    document,
    fields,
    completedFields,
    signatures,
    isDocumentAccessValid: true,
    documentMeta,
    teamSettings,
    isRecipientExpired: isRecipientExpired(recipient),
  });
};

const handleV2Loader = async ({ params, request }: Route.LoaderArgs) => {
  const { requestMetadata } = getOptionalLoaderContext();

  const { user } = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    throw new Response('Not Found', { status: 404 });
  }

  const [envelope, requiredAccess] = await Promise.all([
    getEnvelopeForRecipientSigning({
      token,
      userId: user?.id,
      requestMetadata,
    }).catch(() => null),
    getEnvelopeRequiredAccessData({ token }).catch(() => null),
  ]);

  if (!envelope || !requiredAccess) {
    throw new Response('Not Found', { status: 404 });
  }

  const recipient = envelope.recipients.find((r) => r.token === token);

  if (!recipient) {
    throw new Response('Not Found', { status: 404 });
  }

  if (recipient.signingStatus === SigningStatus.REJECTED) {
    throw redirect(`/sign/${token}/rejected`);
  }

  if (recipient.signingStatus === SigningStatus.SIGNED) {
    throw redirect(`/sign/${token}/complete`);
  }

  if (isRecipientExpired(recipient)) {
    throw redirect(`/sign/${token}/expired`);
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.envelopeSettings,
    recipientAuth: recipient.authOptions,
  });

  const isAccessAuthValid = derivedRecipientAccessAuth.every((accessAuth) =>
    match(accessAuth)
      .with(DocumentAccessAuth.ACCOUNT, () => user && user.email === recipient.email)
      .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => true) // Allow without account requirement
      .exhaustive(),
  );

  if (!isAccessAuthValid) {
    const recipientHasAccount = await getUserByEmail({ email: recipient.email })
      .then((user) => !!user)
      .catch(() => false);

    return superLoaderJson({
      isDocumentAccessValid: false,
      recipientEmail: recipient.email,
      recipientHasAccount,
      envelope,
      requiredAccess,
    } as const);
  }

  return superLoaderJson({
    isDocumentAccessValid: true,
    envelope,
    requiredAccess,
    isRecipientExpired: isRecipientExpired(recipient),
  });
};

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  const v2 = url.searchParams.has('v2');

  if (!v2) {
    return handleV1Loader({ params, request });
  }

  return handleV2Loader({ params, request });
};

export default function SignDocumentPage() {
  const data = useSuperLoaderData<typeof loader>();

  const { user } = useOptionalSession();

  if (!data.isDocumentAccessValid && 'envelope' in data) {
    return (
      <DocumentSigningAuthProvider
        envelope={data.envelope}
        requiredAccess={data.requiredAccess}
        recipientEmail={data.recipientEmail}
        recipientHasAccount={data.recipientHasAccount}
      >
        <DocumentSigningAuthPageView />
      </DocumentSigningAuthProvider>
    );
  }

  if (!data.isDocumentAccessValid && 'document' in data) {
    return (
      <DocumentSigningAuthProvider
        documentMeta={data.documentMeta}
        recipientEmail={data.recipientEmail}
        recipientHasAccount={data.recipientHasAccount}
      >
        <DocumentSigningAuthPageView />
      </DocumentSigningAuthProvider>
    );
  }

  if ('envelope' in data) {
    return (
      <div className="relative flex min-h-screen">
        <AuthenticatedHeader user={user} />
        <div className="absolute inset-0 -z-10 h-full w-full bg-white">
          <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        </div>
        <div className="fixed left-6 top-1/2 -translate-y-1/2 hidden lg:block">
          <SigningCard3D />
        </div>
        <EnvelopeRenderProvider envelope={data.envelope}>
          <EnvelopeSigningProvider envelope={data.envelope}>
            <DocumentSigningPageViewV2 />
          </EnvelopeSigningProvider>
        </EnvelopeRenderProvider>
      </div>
    );
  }

  if (data.recipients.length === 1 && data.recipients[0]?.role === RecipientRole.SIGNER) {
    return (
      <div className="mx-auto max-w-screen-xl px-4 md:px-8">
        <div className="relative">
          <DocumentSigningProvider
            document={data.document}
            recipient={data.recipients[0]}
            fields={data.fields}
            completedFields={data.completedFields}
            signatures={data.signatures}
            documentMeta={data.documentMeta}
            teamSettings={data.teamSettings}
          >
            <DocumentSigningPageViewV1 />
          </DocumentSigningProvider>
        </div>

        <div className="mx-auto mt-36 max-w-xl pb-16 text-center">
          <h2 className="text-4xl font-semibold">
            <Trans>You're almost done!</Trans>
          </h2>

          <p className="text-muted-foreground mt-4">
            <Trans>
              Once you have filled out all the required fields and signed the document we will
              handle the rest.
            </Trans>
          </p>

          <div className="bg-muted/40 mt-12 rounded-2xl p-8">
            <Clock8 className="text-muted-foreground mx-auto h-12 w-12" />

            <h3 className="mt-4 text-lg font-medium">
              <Trans>What happens next?</Trans>
            </h3>

            <p className="text-muted-foreground mt-2 text-sm">
              <Trans>
                Once you have signed the document, all parties will receive a copy of the completed
                document by email.
              </Trans>
            </p>
          </div>

          <hr className="border-border mt-12" />

          <div className="mt-12">
            <img
              src={signingCelebration}
              alt="Signing celebration"
              className="dark:contrast-[0.8] dark:invert mx-auto h-44 w-44"
            />

            <div className="mx-auto mt-6 max-w-md">
              <h3 className="text-lg font-medium">
                <Trans>Signing complete!</Trans>
              </h3>

              <p className="text-muted-foreground mt-2 text-sm">
                <Trans>
                  Everyone has now signed the document. You will receive a copy via email shortly.
                </Trans>
              </p>
            </div>
          </div>

          <div className="border-border mt-12 rounded-2xl border p-8">
            <h3 className="text-lg font-medium">
              <Trans>Need to make changes?</Trans>
            </h3>

            <p className="text-muted-foreground mt-2 text-sm">
              <Trans>
                Contact the document sender if you need to make any changes to the document.
              </Trans>
            </p>
          </div>

          <hr className="border-border mt-12" />

          <div className="mt-12">
            <p className="mt-36 text-muted-foreground/60 text-sm">
              <Trans>
                Want to send slick signing links like this one?{' '}
                <Link
                  to="https://davincisolutions.ai"
                  className="text-documenso-700 hover:text-documenso-600"
                >
                  Check out Davinci Sign
                </Link>
                .
              </Trans>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 md:px-8">
      <div className="relative">
        <DocumentSigningProvider
          document={data.document}
          recipient={data.recipients[0]}
          fields={data.fields}
          completedFields={data.completedFields}
          signatures={data.signatures}
          documentMeta={data.documentMeta}
          teamSettings={data.teamSettings}
        >
          <DocumentSigningPageViewV1 />
        </DocumentSigningProvider>
      </div>

      <div className="mx-auto mt-36 max-w-xl pb-16 text-center">
        <h2 className="text-4xl font-semibold">
          <Trans>You're almost done!</Trans>
        </h2>

        <p className="text-muted-foreground mt-4">
          <Trans>
            Once you have filled out all the required fields and signed the document we will handle
            the rest.
          </Trans>
        </p>

        <div className="bg-muted/40 mt-12 rounded-2xl p-8">
          <Clock8 className="text-muted-foreground mx-auto h-12 w-12" />

          <h3 className="mt-4 text-lg font-medium">
            <Trans>What happens next?</Trans>
          </h3>

          <p className="text-muted-foreground mt-2 text-sm">
            <Trans>
              Once you have signed the document, all parties will receive a copy of the completed
              document by email.
            </Trans>
          </p>
        </div>

        <hr className="border-border mt-12" />

        <div className="mt-12">
          <img
            src={signingCelebration}
            alt="Signing celebration"
            className="dark:contrast-[0.8] dark:invert mx-auto h-44 w-44"
          />

          <div className="mx-auto mt-6 max-w-md">
            <h3 className="text-lg font-medium">
              <Trans>Signing complete!</Trans>
            </h3>

            <p className="text-muted-foreground mt-2 text-sm">
              <Trans>
                Everyone has now signed the document. You will receive a copy via email shortly.
              </Trans>
            </p>
          </div>
        </div>

        <div className="border-border mt-12 rounded-2xl border p-8">
          <h3 className="text-lg font-medium">
            <Trans>Need to make changes?</Trans>
          </h3>

          <p className="text-muted-foreground mt-2 text-sm">
            <Trans>
              Contact the document sender if you need to make any changes to the document.
            </Trans>
          </p>
        </div>

        <hr className="border-border mt-12" />

        <div className="mt-12">
          <p className="mt-36 text-muted-foreground/60 text-sm">
            <Trans>
              Want to send slick signing links like this one?{' '}
              <Link
                to="https://davincisolutions.ai"
                className="text-documenso-700 hover:text-documenso-600"
              >
                Check out Davinci Sign
              </Link>
              .
            </Trans>
          </p>
        </div>
      </div>
    </div>
  );
}