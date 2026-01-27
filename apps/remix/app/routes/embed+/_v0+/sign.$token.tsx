import { RecipientRole } from '@prisma/client';
import { data } from 'react-router';
import { match } from 'ts-pattern';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { viewedDocument } from '@documenso/lib/server-only/document/viewed-document';
import { getEnvelopeForRecipientSigning } from '@documenso/lib/server-only/envelope/get-envelope-for-recipient-signing';
import { getEnvelopeRequiredAccessData } from '@documenso/lib/server-only/envelope/get-envelope-required-access-data';
import { getCompletedFieldsForToken } from '@documenso/lib/server-only/field/get-completed-fields-for-token';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getOrganisationClaimByTeamId } from '@documenso/lib/server-only/organisation/get-organisation-claims';
import { getIsRecipientsTurnToSign } from '@documenso/lib/server-only/recipient/get-is-recipient-turn';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getRecipientsForAssistant } from '@documenso/lib/server-only/recipient/get-recipients-for-assistant';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';

import { EmbedSignDocumentV1ClientPage } from '~/components/embed/embed-document-signing-page-v1';
import { EmbedSignDocumentV2ClientPage } from '~/components/embed/embed-document-signing-page-v2';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { EnvelopeSigningProvider } from '~/components/general/document-signing/envelope-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import { getOptionalLoaderContext } from '../../../../server/utils/get-loader-session';
import type { Route } from './+types/sign.$token';

async function handleV1Loader({ params, request }: Route.LoaderArgs) {
  const { requestMetadata } = getOptionalLoaderContext();

  if (!params.token) {
    throw new Response('Not found', { status: 404 });
  }

  const token = params.token;

  const { user } = await getOptionalSession(request);

  const [document, fields, recipient, completedFields] = await Promise.all([
    getDocumentAndSenderByToken({
      token,
      userId: user?.id,
      requireAccessAuth: false,
    }).catch(() => null),
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
    getCompletedFieldsForToken({ token }).catch(() => []),
  ]);

  // `document.directLink` is always available but we're doing this to
  // satisfy the type checker.
  if (!document || !recipient) {
    throw new Response('Not found', { status: 404 });
  }

  const organisationClaim = await getOrganisationClaimByTeamId({ teamId: document.teamId });

  const allowEmbedSigningWhitelabel = organisationClaim.flags.embedSigningWhiteLabel;
  const hidePoweredBy = organisationClaim.flags.hidePoweredBy;

  // TODO: Make this more robust, we need to ensure the owner is either
  // TODO: the member of a team that has an active subscription, is an early
  // TODO: adopter or is an enterprise user.
  if (IS_BILLING_ENABLED() && !organisationClaim.flags.embedSigning) {
    throw data(
      {
        type: 'embed-paywall',
      },
      {
        status: 403,
      },
    );
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  const isAccessAuthValid = derivedRecipientAccessAuth.every((accesssAuth) =>
    match(accesssAuth)
      .with(DocumentAccessAuth.ACCOUNT, () => user && user.email === recipient.email)
      .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => true) // Allow without account requirement
      .exhaustive(),
  );

  if (!isAccessAuthValid) {
    throw data(
      {
        type: 'embed-authentication-required',
        email: user?.email || recipient.email,
        returnTo: `/embed/sign/${token}`,
      },
      {
        status: 401,
      },
    );
  }

  const isRecipientsTurnToSign = await getIsRecipientsTurnToSign({ token });

  if (!isRecipientsTurnToSign) {
    throw data(
      {
        type: 'embed-waiting-for-turn',
      },
      {
        status: 403,
      },
    );
  }

  await viewedDocument({
    token,
    requestMetadata,
    recipientAccessAuth: derivedRecipientAccessAuth,
  });

  const allRecipients =
    recipient.role === RecipientRole.ASSISTANT
      ? await getRecipientsForAssistant({
          token,
        })
      : [];

  return {
    token,
    user,
    document,
    allRecipients,
    recipient,
    fields,
    completedFields,
    hidePoweredBy,
    allowEmbedSigningWhitelabel,
  };
}

async function handleV2Loader({ params, request }: Route.LoaderArgs) {
  const { requestMetadata } = getOptionalLoaderContext();

  if (!params.token) {
    throw new Response('Not found', { status: 404 });
  }

  const token = params.token;

  const { user } = await getOptionalSession(request);

  const envelopeForSigning = await getEnvelopeForRecipientSigning({
    token,
    userId: user?.id,
  })
    .then((envelopeForSigning) => {
      return {
        isDocumentAccessValid: true,
        ...envelopeForSigning,
      } as const;
    })
    .catch(async (e) => {
      const error = AppError.parseError(e);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        const requiredAccessData = await getEnvelopeRequiredAccessData({ token });

        return {
          isDocumentAccessValid: false,
          ...requiredAccessData,
        } as const;
      }

      throw new Response('Not Found', { status: 404 });
    });

  if (!envelopeForSigning.isDocumentAccessValid) {
    throw data(
      {
        type: 'embed-authentication-required',
        email: envelopeForSigning.recipientEmail,
        returnTo: `/embed/sign/${token}`,
      },
      {
        status: 401,
      },
    );
  }

  const { envelope, recipient, isRecipientsTurn } = envelopeForSigning;

  const organisationClaim = await getOrganisationClaimByTeamId({ teamId: envelope.teamId });

  const allowEmbedSigningWhitelabel = organisationClaim.flags.embedSigningWhiteLabel;
  const hidePoweredBy = organisationClaim.flags.hidePoweredBy;

  if (IS_BILLING_ENABLED() && !organisationClaim.flags.embedSigning) {
    throw data(
      {
        type: 'embed-paywall',
      },
      {
        status: 403,
      },
    );
  }

  if (!isRecipientsTurn) {
    throw data(
      {
        type: 'embed-waiting-for-turn',
      },
      {
        status: 403,
      },
    );
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
    recipientAuth: recipient.authOptions,
  });

  const isAccessAuthValid = derivedRecipientAccessAuth.every((accesssAuth) =>
    match(accesssAuth)
      .with(DocumentAccessAuth.ACCOUNT, () => user && user.email === recipient.email)
      .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => true)
      .exhaustive(),
  );

  if (!isAccessAuthValid) {
    throw data(
      {
        type: 'embed-authentication-required',
        email: user?.email || recipient.email,
        returnTo: `/embed/sign/${token}`,
      },
      {
        status: 401,
      },
    );
  }

  await viewedDocument({
    token,
    requestMetadata,
    recipientAccessAuth: derivedRecipientAccessAuth,
  }).catch(() => null);

  return {
    token,
    user,
    envelopeForSigning,
    hidePoweredBy,
    allowEmbedSigningWhitelabel,
  };
}

export async function loader(loaderArgs: Route.LoaderArgs) {
  const { token } = loaderArgs.params;

  if (!token) {
    throw new Response('Not Found', { status: 404 });
  }

  // Not efficient but works for now until we remove v1.
  const foundRecipient = await prisma.recipient.findFirst({
    where: {
      token,
    },
    select: {
      envelope: {
        select: {
          internalVersion: true,
        },
      },
    },
  });

  if (!foundRecipient) {
    throw new Response('Not Found', { status: 404 });
  }

  if (foundRecipient.envelope.internalVersion === 2) {
    const payloadV2 = await handleV2Loader(loaderArgs);

    return superLoaderJson({
      version: 2,
      payload: payloadV2,
    } as const);
  }

  const payloadV1 = await handleV1Loader(loaderArgs);

  return superLoaderJson({
    version: 1,
    payload: payloadV1,
  } as const);
}

export default function EmbedSignDocumentPage() {
  const { version, payload } = useSuperLoaderData<typeof loader>();

  if (version === 1) {
    return <EmbedSignDocumentPageV1 data={payload} />;
  }

  return <EmbedSignDocumentPageV2 data={payload} />;
}

const EmbedSignDocumentPageV1 = ({
  data,
}: {
  data: Awaited<ReturnType<typeof handleV1Loader>>;
}) => {
  const {
    token,
    user,
    document,
    allRecipients,
    recipient,
    fields,
    completedFields,
    hidePoweredBy,
    allowEmbedSigningWhitelabel,
  } = data;

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
        <EmbedSignDocumentV1ClientPage
          token={token}
          documentId={document.id}
          envelopeId={document.envelopeId}
          envelopeItems={document.envelopeItems}
          recipient={recipient}
          fields={fields}
          completedFields={completedFields}
          metadata={document.documentMeta}
          isCompleted={isDocumentCompleted(document.status)}
          hidePoweredBy={hidePoweredBy}
          allowWhitelabelling={allowEmbedSigningWhitelabel}
          allRecipients={allRecipients}
        />
      </DocumentSigningAuthProvider>
    </DocumentSigningProvider>
  );
};

const EmbedSignDocumentPageV2 = ({
  data,
}: {
  data: Awaited<ReturnType<typeof handleV2Loader>>;
}) => {
  const { token, user, envelopeForSigning, hidePoweredBy, allowEmbedSigningWhitelabel } = data;

  const { envelope, recipient } = envelopeForSigning;

  return (
    <EnvelopeSigningProvider
      envelopeData={envelopeForSigning}
      email={recipient.email}
      fullName={user?.email === recipient.email ? user?.name : recipient.name}
      signature={user?.email === recipient.email ? user?.signature : undefined}
    >
      <DocumentSigningAuthProvider
        documentAuthOptions={envelope.authOptions}
        recipient={recipient}
        user={user}
      >
        <EnvelopeRenderProvider envelope={envelope} token={token}>
          <EmbedSignDocumentV2ClientPage
            hidePoweredBy={hidePoweredBy}
            allowWhitelabelling={allowEmbedSigningWhitelabel}
          />
        </EnvelopeRenderProvider>
      </DocumentSigningAuthProvider>
    </EnvelopeSigningProvider>
  );
};
