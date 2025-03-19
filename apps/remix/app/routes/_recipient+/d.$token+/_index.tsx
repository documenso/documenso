import { Plural } from '@lingui/react/macro';
import { UsersIcon } from 'lucide-react';
import { redirect } from 'react-router';
import { match } from 'ts-pattern';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { getTemplateByDirectLinkToken } from '@documenso/lib/server-only/template/get-template-by-direct-link-token';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';

import { DirectTemplatePageView } from '~/components/general/direct-template/direct-template-page';
import { DirectTemplateAuthPageView } from '~/components/general/direct-template/direct-template-signing-auth-page';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/_index';

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    throw redirect('/');
  }

  const template = await getTemplateByDirectLinkToken({
    token,
  }).catch(() => null);

  if (!template || !template.directLink?.enabled) {
    throw new Response('Not Found', { status: 404 });
  }

  const directTemplateRecipient = template.recipients.find(
    (recipient) => recipient.id === template.directLink?.directTemplateRecipientId,
  );

  if (!directTemplateRecipient) {
    throw new Response('Not Found', { status: 404 });
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  // Ensure typesafety when we add more options.
  const isAccessAuthValid = match(derivedRecipientAccessAuth)
    .with(DocumentAccessAuth.ACCOUNT, () => Boolean(session.user))
    .with(null, () => true)
    .exhaustive();

  if (!isAccessAuthValid) {
    return superLoaderJson({
      isAccessAuthValid: false as const,
    });
  }

  return superLoaderJson({
    isAccessAuthValid: true,
    template,
    directTemplateRecipient,
  } as const);
}

export default function DirectTemplatePage() {
  const { sessionData } = useOptionalSession();
  const user = sessionData?.user;

  const data = useSuperLoaderData<typeof loader>();

  // Should not be possible for directLink to be null.
  if (!data.isAccessAuthValid) {
    return <DirectTemplateAuthPageView />;
  }

  const { template, directTemplateRecipient } = data;

  return (
    <DocumentSigningProvider
      email={user?.email}
      fullName={user?.name}
      signature={user?.signature}
      typedSignatureEnabled={template.templateMeta?.typedSignatureEnabled}
      uploadSignatureEnabled={template.templateMeta?.uploadSignatureEnabled}
      drawSignatureEnabled={template.templateMeta?.drawSignatureEnabled}
    >
      <DocumentSigningAuthProvider
        documentAuthOptions={template.authOptions}
        recipient={directTemplateRecipient}
        user={user}
      >
        <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
          <h1
            className="mt-4 block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
            title={template.title}
          >
            {template.title}
          </h1>

          <div className="text-muted-foreground mb-8 mt-2.5 flex items-center gap-x-2">
            <UsersIcon className="h-4 w-4" />
            <p className="text-muted-foreground/80">
              <Plural value={template.recipients.length} one="# recipient" other="# recipients" />
            </p>
          </div>

          <DirectTemplatePageView
            directTemplateRecipient={directTemplateRecipient}
            directTemplateToken={template.directLink.token}
            template={template}
          />
        </div>
      </DocumentSigningAuthProvider>
    </DocumentSigningProvider>
  );
}
