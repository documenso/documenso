import { RecipientRole } from '@prisma/client';
import { data } from 'react-router';
import { match } from 'ts-pattern';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { isCommunityPlan as isUserCommunityPlan } from '@documenso/ee/server-only/util/is-community-plan';
import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { isDocumentPlatform } from '@documenso/ee/server-only/util/is-document-platform';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getCompletedFieldsForToken } from '@documenso/lib/server-only/field/get-completed-fields-for-token';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getIsRecipientsTurnToSign } from '@documenso/lib/server-only/recipient/get-is-recipient-turn';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getRecipientsForAssistant } from '@documenso/lib/server-only/recipient/get-recipients-for-assistant';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';

import { EmbedSignDocumentClientPage } from '~/components/embed/embed-document-signing-page';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/sign.$url';

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!params.url) {
    throw new Response('Not found', { status: 404 });
  }

  const token = params.url;

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

  // TODO: Make this more robust, we need to ensure the owner is either
  // TODO: the member of a team that has an active subscription, is an early
  // TODO: adopter or is an enterprise user.
  if (IS_BILLING_ENABLED() && !document.teamId) {
    throw data(
      {
        type: 'embed-paywall',
      },
      {
        status: 403,
      },
    );
  }

  const [isPlatformDocument, isEnterpriseDocument, isCommunityPlan] = await Promise.all([
    isDocumentPlatform(document),
    isUserEnterprise({
      userId: document.userId,
      teamId: document.teamId ?? undefined,
    }),
    isUserCommunityPlan({
      userId: document.userId,
      teamId: document.teamId ?? undefined,
    }),
  ]);

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  const isAccessAuthValid = match(derivedRecipientAccessAuth)
    .with(DocumentAccessAuth.ACCOUNT, () => user !== null)
    .with(null, () => true)
    .exhaustive();

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

  const allRecipients =
    recipient.role === RecipientRole.ASSISTANT
      ? await getRecipientsForAssistant({
          token,
        })
      : [];

  const team = document.teamId
    ? await getTeamById({ teamId: document.teamId, userId: document.userId }).catch(() => null)
    : null;

  const hidePoweredBy = team?.teamGlobalSettings?.brandingHidePoweredBy ?? false;

  return superLoaderJson({
    token,
    user,
    document,
    allRecipients,
    recipient,
    fields,
    completedFields,
    hidePoweredBy,
    isPlatformDocument,
    isEnterpriseDocument,
    isCommunityPlan,
  });
}

export default function EmbedSignDocumentPage() {
  const {
    token,
    user,
    document,
    allRecipients,
    recipient,
    fields,
    completedFields,
    hidePoweredBy,
    isPlatformDocument,
    isEnterpriseDocument,
    isCommunityPlan,
  } = useSuperLoaderData<typeof loader>();

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
        <EmbedSignDocumentClientPage
          token={token}
          documentId={document.id}
          documentData={document.documentData}
          recipient={recipient}
          fields={fields}
          completedFields={completedFields}
          metadata={document.documentMeta}
          isCompleted={isDocumentCompleted(document.status)}
          hidePoweredBy={
            isCommunityPlan || isPlatformDocument || isEnterpriseDocument || hidePoweredBy
          }
          allowWhitelabelling={isCommunityPlan || isPlatformDocument || isEnterpriseDocument}
          allRecipients={allRecipients}
        />
      </DocumentSigningAuthProvider>
    </DocumentSigningProvider>
  );
}
