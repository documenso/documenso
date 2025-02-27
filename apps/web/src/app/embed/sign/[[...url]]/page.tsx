import { notFound } from 'next/navigation';

import { match } from 'ts-pattern';

import { isCommunityPlan as isUserCommunityPlan } from '@documenso/ee/server-only/util/is-community-plan';
import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { isDocumentPlatform } from '@documenso/ee/server-only/util/is-document-platform';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getIsRecipientsTurnToSign } from '@documenso/lib/server-only/recipient/get-is-recipient-turn';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getRecipientsForAssistant } from '@documenso/lib/server-only/recipient/get-recipients-for-assistant';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { DocumentStatus, RecipientRole } from '@documenso/prisma/client';

import { DocumentAuthProvider } from '~/app/(signing)/sign/[token]/document-auth-provider';
import { SigningProvider } from '~/app/(signing)/sign/[token]/provider';

import { EmbedAuthenticateView } from '../../authenticate';
import { EmbedPaywall } from '../../paywall';
import { EmbedWaitingForTurn } from '../../waiting-for-turn';
import { EmbedSignDocumentClientPage } from './client';

export type EmbedSignDocumentPageProps = {
  params: {
    url?: string[];
  };
};

export default async function EmbedSignDocumentPage({ params }: EmbedSignDocumentPageProps) {
  if (params.url?.length !== 1) {
    return notFound();
  }

  const [token] = params.url;

  const { user } = await getServerComponentSession();

  const [document, fields, recipient] = await Promise.all([
    getDocumentAndSenderByToken({
      token,
      userId: user?.id,
      requireAccessAuth: false,
    }).catch(() => null),
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  // `document.directLink` is always available but we're doing this to
  // satisfy the type checker.
  if (!document || !recipient) {
    return notFound();
  }

  // TODO: Make this more robust, we need to ensure the owner is either
  // TODO: the member of a team that has an active subscription, is an early
  // TODO: adopter or is an enterprise user.
  if (IS_BILLING_ENABLED() && !document.teamId) {
    return <EmbedPaywall />;
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
    return (
      <EmbedAuthenticateView
        email={user?.email || recipient.email}
        returnTo={`/embed/sign/${token}`}
      />
    );
  }

  const isRecipientsTurnToSign = await getIsRecipientsTurnToSign({ token });

  if (!isRecipientsTurnToSign) {
    return <EmbedWaitingForTurn />;
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

  return (
    <SigningProvider
      email={recipient.email}
      fullName={user?.email === recipient.email ? user?.name : recipient.name}
      signature={user?.email === recipient.email ? user?.signature : undefined}
    >
      <DocumentAuthProvider
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
          metadata={document.documentMeta}
          isCompleted={document.status === DocumentStatus.COMPLETED}
          hidePoweredBy={
            isCommunityPlan || isPlatformDocument || isEnterpriseDocument || hidePoweredBy
          }
          allowWhitelabelling={isCommunityPlan || isPlatformDocument || isEnterpriseDocument}
          allRecipients={allRecipients}
        />
      </DocumentAuthProvider>
    </SigningProvider>
  );
}
