import { notFound } from 'next/navigation';

import { match } from 'ts-pattern';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTemplateByDirectLinkToken } from '@documenso/lib/server-only/template/get-template-by-direct-link-token';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';

import { DocumentAuthProvider } from '~/app/(signing)/sign/[token]/document-auth-provider';
import { SigningProvider } from '~/app/(signing)/sign/[token]/provider';

import { EmbedAuthenticateView } from '../../authenticate';
import { EmbedPaywall } from '../../paywall';
import { EmbedDirectTemplateClientPage } from './client';

export type EmbedDirectTemplatePageProps = {
  params: {
    url?: string[];
  };
};

export default async function EmbedDirectTemplatePage({ params }: EmbedDirectTemplatePageProps) {
  if (params.url?.length !== 1) {
    return notFound();
  }

  const [token] = params.url;

  const template = await getTemplateByDirectLinkToken({
    token,
  }).catch(() => null);

  // `template.directLink` is always available but we're doing this to
  // satisfy the type checker.
  if (!template || !template.directLink) {
    return notFound();
  }

  // TODO: Make this more robust, we need to ensure the owner is either
  // TODO: the member of a team that has an active subscription, is an early
  // TODO: adopter or is an enterprise user.
  if (IS_BILLING_ENABLED() && !template.teamId) {
    return <EmbedPaywall />;
  }

  const { user } = await getServerComponentSession();

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const isAccessAuthValid = match(derivedRecipientAccessAuth)
    .with(DocumentAccessAuth.ACCOUNT, () => user !== null)
    .with(null, () => true)
    .exhaustive();

  if (!isAccessAuthValid) {
    return <EmbedAuthenticateView email={user?.email} returnTo={`/embed/direct/${token}`} />;
  }

  const { directTemplateRecipientId } = template.directLink;

  const recipient = template.Recipient.find(
    (recipient) => recipient.id === directTemplateRecipientId,
  );

  if (!recipient) {
    return notFound();
  }

  const fields = template.Field.filter((field) => field.recipientId === directTemplateRecipientId);

  return (
    <SigningProvider
      email={user?.email}
      fullName={user?.name}
      signature={user?.signature}
    >
      <DocumentAuthProvider
        documentAuthOptions={template.authOptions}
        recipient={recipient}
        user={user}
      >
        <EmbedDirectTemplateClientPage
          token={token}
          updatedAt={template.updatedAt}
          documentData={template.templateDocumentData}
          recipient={recipient}
          fields={fields}
          metadata={template.templateMeta}
        />
      </DocumentAuthProvider>
    </SigningProvider>
  );
}
