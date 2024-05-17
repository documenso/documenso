import { notFound, redirect } from 'next/navigation';

import { UsersIcon } from 'lucide-react';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTemplateByDirectAccessToken } from '@documenso/lib/server-only/template/get-template-by-direct-access-token';

import { DocumentAuthProvider } from '~/app/(signing)/sign/[token]/document-auth-provider';
import { SigningProvider } from '~/app/(signing)/sign/[token]/provider';
import { truncateTitle } from '~/helpers/truncate-title';

import { DirectTemplatePageView } from './direct-template';

export type TemplatesDirectPageProps = {
  params: {
    token: string;
  };
};

export default async function TemplatesDirectPage({ params }: TemplatesDirectPageProps) {
  const { token } = params;

  if (!token) {
    redirect('/');
  }

  const { user } = await getServerComponentSession();

  const template = await getTemplateByDirectAccessToken({
    token,
  }).catch(() => null);

  if (!template || !template.access?.enabled) {
    notFound();
  }

  const directTemplateRecipient = template.Recipient.find(
    (recipient) => recipient.id === template.access?.directTemplateRecipientId,
  );

  if (!directTemplateRecipient) {
    notFound();
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
              {template.Recipient.length}{' '}
              {template.Recipient.length > 1 ? 'recipients' : 'recipient'}
            </p>
          </div>

          <DirectTemplatePageView
            directTemplateRecipient={directTemplateRecipient}
            directTemplateToken={template.access.token}
            template={template}
          />
        </div>
      </DocumentAuthProvider>
    </SigningProvider>
  );
}
