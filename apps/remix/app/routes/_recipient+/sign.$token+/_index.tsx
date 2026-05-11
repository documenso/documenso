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
import { loadRecipientBrandingByTeamId } from '@documenso/lib/server-only/branding/load-recipient-branding';
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
import { RecipientBranding } from '~/components/general/recipient-branding';
import { useCspNonce } from '~/utils/nonce';
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

  const [includeSenderDetails, recipientSignatures] = await Promise.all([
    getTeamSettings({ teamId: document.teamId }).then(
      (teamSettings) => teamSettings?.includeSenderDetails ?? false,
    ),
    getRecipientSignatures({
      documentId: document.id,
    }),
  ]);

  const recipientSignature = recipientSignatures?.find(
    (signature) => signature.recipientId === recipient.id,
  );

  return {
    isDocumentAccessValid: true,
    document,
    fields,
    recipient,
    completedFields,
    recipientSignature,
    isRecipientsTurn,
    allRecipients,
    includeSenderDetails,
    recipientWithFields,
  } as const;
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

    return {
      isDocumentAccessValid: false,
      recipientEmail: recipient.email,
      recipientHasAccount,
      envelope,
      requiredAccess,
    } as const;
  }

  return {
    isDocumentAccessValid: true,
    envelope,
    requiredAccess,
    isRecipientExpired: isRecipientExpired(recipient),
  } as const;
};

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  const loaderArgs = { params, request };

  // Try to find the recipient with envelope information first
  const foundRecipient = await prisma.recipient.findUnique({
    where: {
      token: params.token,
    },
    select: {
      envelope: {
        select: {
          internalVersion: true,
          teamId: true,
        },
      },
    },
  });

  if (!foundRecipient) {
    throw new Response('Not Found', { status: 404 });
  }

  const branding = await loadRecipientBrandingByTeamId({
    teamId: foundRecipient.envelope.teamId,
  });

  if (foundRecipient.envelope.internalVersion === 2) {
    const payloadV2 = await handleV2Loader(loaderArgs);

    return superLoaderJson({
      version: 2,
      payload: payloadV2,
      branding,
    } as const);
  }

  const payloadV1 = await handleV1Loader(loaderArgs);

  return superLoaderJson({
    version: 1,
    payload: payloadV1,
    branding,
  } as const);
};

export default function SignDocumentPage() {
  const data = useSuperLoaderData<typeof loader>();
  const cspNonce = useCspNonce();

  return (
    <>
      <RecipientBranding branding={data.branding} cspNonce={cspNonce} />
      {data.version === 2 ? <SigningPageV2 data={data.payload} /> : <SigningPageV1 data={data.payload} />}
    </>
  );
}

const SigningPageV1 = ({ data }: { data: Awaited<ReturnType<typeof handleV1Loader>> }) => {
  const { sessionData } = useOptionalSession();

  const user = sessionData?.user;

  if (!data.isDocumentAccessValid) {
    return <DocumentSigningAuthPageView email={data.recipientEmail} emailHasAccount={!!data.recipientHasAccount} />;
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
      <div className="flex h-screen items-center justify-center">
        <div className="mx-auto max-w-[40rem] text-center">
          <img className="mx-auto size-72" src={signingCelebration} alt="Document rejected" />

          <h1 className="mb-4 text-4xl font-bold">
            <Trans>This document has been rejected</Trans>
          </h1>

          <p className="mb-4 text-lg text-muted-foreground">
            <Trans>This document has either been rejected or has expired.</Trans>
          </p>

          <p className="text-muted-foreground">
            <Trans>If you believe this is an error, please contact the document sender.</Trans>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen">
      <AuthenticatedHeader user={user} />
      <div className="absolute inset-0 -z-10 h-full w-full bg-white">
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>
      <div className="fixed left-6 top-1/2 -translate-y-1/2 hidden lg:block">
        <SigningCard3D className="h-48 w-32" />
      </div>

      <div className="ml-auto w-full lg:max-w-[60rem]">
        <EnvelopeRenderProvider>
          <DocumentSigningProvider
            user={user}
            document={document}
            fields={fields}
            recipients={allRecipients}
            recipient={recipient}
            completedFields={completedFields}
            signature={recipientSignature}
            includeSenderDetails={includeSenderDetails}
          >
            <DocumentSigningPageViewV1 />
          </DocumentSigningProvider>
        </EnvelopeRenderProvider>
      </div>
    </div>
  );
};

const SigningPageV2 = ({ data }: { data: Awaited<ReturnType<typeof handleV2Loader>> }) => {
  const { sessionData } = useOptionalSession();

  const user = sessionData?.user;

  if (!data.isDocumentAccessValid) {
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

  const { envelope, requiredAccess } = data;

  return (
    <div className="relative flex min-h-screen">
      <AuthenticatedHeader user={user} />
      <div className="absolute inset-0 -z-10 h-full w-full bg-white">
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>
      <div className="fixed left-6 top-1/2 -translate-y-1/2 hidden lg:block">
        <SigningCard3D className="h-48 w-32" />
      </div>

      <div className="ml-auto w-full lg:max-w-[60rem]">
        <EnvelopeRenderProvider>
          <EnvelopeSigningProvider user={user} envelope={envelope} requiredAccess={requiredAccess}>
            <DocumentSigningPageViewV2 />
          </EnvelopeSigningProvider>
        </EnvelopeRenderProvider>
      </div>
    </div>
  );
};