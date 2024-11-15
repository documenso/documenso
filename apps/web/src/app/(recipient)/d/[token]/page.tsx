import { notFound, redirect } from 'next/navigation';

import { Plural } from '@lingui/macro';
import { UsersIcon } from 'lucide-react';
import { match } from 'ts-pattern';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTemplateByDirectLinkToken } from '@documenso/lib/server-only/template/get-template-by-direct-link-token';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';

import { DocumentAuthProvider } from '~/app/(signing)/sign/[token]/document-auth-provider';
import { SigningProvider } from '~/app/(signing)/sign/[token]/provider';
import { truncateTitle } from '~/helpers/truncate-title';

import { DirectTemplatePageView } from './direct-template';
import { DirectTemplateAuthPageView } from './signing-auth-page';

export type TemplatesDirectPageProps = {
  params: {
    token: string;
  };
};

export default async function TemplatesDirectPage({ params }: TemplatesDirectPageProps) {
  await setupI18nSSR();

  const { token } = params;

  if (!token) {
    redirect('/');
  }

  const { user } = await getServerComponentSession();

  const template = await getTemplateByDirectLinkToken({
    token,
  }).catch(() => null);

  if (!template || !template.directLink?.enabled) {
    notFound();
  }

  const directTemplateRecipient = template.Recipient.find(
    (recipient) => recipient.id === template.directLink?.directTemplateRecipientId,
  );

  if (!directTemplateRecipient) {
    notFound();
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  // Ensure typesafety when we add more options.
  const isAccessAuthValid = match(derivedRecipientAccessAuth)
    .with(DocumentAccessAuth.ACCOUNT, () => user !== null)
    .with(null, () => true)
    .exhaustive();

  if (!isAccessAuthValid) {
    return <DirectTemplateAuthPageView />;
  }

  return (
    <SigningProvider email={user?.email} fullName={user?.name} signature={user?.signature}>
      <DocumentAuthProvider
        documentAuthOptions={template.authOptions}
        recipient={directTemplateRecipient}
        user={user}
      >
        <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
          <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl" title={template.title}>
            {truncateTitle(template.title)}
          </h1>

          <div className="text-muted-foreground mb-8 mt-2.5 flex items-center gap-x-2">
            <UsersIcon className="h-4 w-4" />
            <p className="text-muted-foreground/80">
              <Plural value={template.Recipient.length} one="# recipient" other="# recipients" />
            </p>
          </div>

          <DirectTemplatePageView
            directTemplateRecipient={directTemplateRecipient}
            directTemplateToken={template.directLink.token}
            template={template}
          />
        </div>
      </DocumentAuthProvider>
    </SigningProvider>
  );
}
