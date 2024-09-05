import { notFound } from 'next/navigation';

import { match } from 'ts-pattern';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';

import { DocumentAuthProvider } from '~/app/(signing)/sign/[token]/document-auth-provider';
import { SigningProvider } from '~/app/(signing)/sign/[token]/provider';

import { EmbedAuthenticateView } from '../../authenticate';
import { EmbedPaywall } from '../../paywall';
import { EmbedSignDocumentClientPage } from './client';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { DocumentStatus } from '@documenso/prisma/client';

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

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  const isAccessAuthValid = match(derivedRecipientAccessAuth)
    .with(DocumentAccessAuth.ACCOUNT, () => user !== null)
    .with(null, () => true)
    .exhaustive();

  if (!isAccessAuthValid) {
    return <EmbedAuthenticateView email={user?.email || recipient.email} returnTo={`/embed/direct/${token}`} />;
  }

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
        />
      </DocumentAuthProvider>
    </SigningProvider>
  );
}
