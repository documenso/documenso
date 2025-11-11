import { Plural } from '@lingui/react/macro';
import { UsersIcon } from 'lucide-react';
import { redirect } from 'react-router';
import { match } from 'ts-pattern';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeForDirectTemplateSigning } from '@documenso/lib/server-only/envelope/get-envelope-for-direct-template-signing';
import { getTemplateByDirectLinkToken } from '@documenso/lib/server-only/template/get-template-by-direct-link-token';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';

import { Header as AuthenticatedHeader } from '~/components/general/app-header';
import { DirectTemplatePageView } from '~/components/general/direct-template/direct-template-page';
import { DirectTemplateAuthPageView } from '~/components/general/direct-template/direct-template-signing-auth-page';
import { DocumentSigningAuthPageView } from '~/components/general/document-signing/document-signing-auth-page';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningPageViewV2 } from '~/components/general/document-signing/document-signing-page-view-v2';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { EnvelopeSigningProvider } from '~/components/general/document-signing/envelope-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/_index';

const handleV1Loader = async ({ params, request }: Route.LoaderArgs) => {
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
  const isAccessAuthValid = derivedRecipientAccessAuth.every((auth) =>
    match(auth)
      .with(DocumentAccessAuth.ACCOUNT, () => Boolean(session.user))
      .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => true)
      .exhaustive(),
  );

  if (!isAccessAuthValid) {
    return {
      isAccessAuthValid: false as const,
    };
  }

  return {
    isAccessAuthValid: true,
    template: {
      ...template,
      folder: null,
    },
    directTemplateRecipient,
  } as const;
};

const handleV2Loader = async ({ params, request }: Route.LoaderArgs) => {
  const session = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    throw redirect('/');
  }

  return await getEnvelopeForDirectTemplateSigning({
    token,
    userId: session?.user?.id,
  })
    .then((envelopeForSigning) => {
      return {
        isDocumentAccessValid: true,
        envelopeForSigning,
      } as const;
    })
    .catch((e) => {
      const error = AppError.parseError(e);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        return {
          isDocumentAccessValid: false,
        } as const;
      }

      throw new Response('Not Found', { status: 404 });
    });
};

export async function loader(loaderArgs: Route.LoaderArgs) {
  const { token } = loaderArgs.params;

  if (!token) {
    throw redirect('/');
  }

  const directEnvelope = await prisma.envelope.findFirst({
    where: {
      directLink: {
        enabled: true,
        token,
      },
    },
    select: {
      internalVersion: true,
    },
  });

  if (!directEnvelope) {
    throw new Response('Not Found', { status: 404 });
  }

  if (directEnvelope.internalVersion === 2) {
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

export default function DirectTemplatePage() {
  const data = useSuperLoaderData<typeof loader>();

  if (data.version === 2) {
    return <DirectSigningPageV2 data={data.payload} />;
  }

  return <DirectSigningPageV1 data={data.payload} />;
}

const DirectSigningPageV1 = ({ data }: { data: Awaited<ReturnType<typeof handleV1Loader>> }) => {
  const { sessionData } = useOptionalSession();

  const user = sessionData?.user;

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
        isDirectTemplate={true}
        user={user}
      >
        <>
          {sessionData?.user && <AuthenticatedHeader />}

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
        </>
      </DocumentSigningAuthProvider>
    </DocumentSigningProvider>
  );
};

const DirectSigningPageV2 = ({ data }: { data: Awaited<ReturnType<typeof handleV2Loader>> }) => {
  const { sessionData } = useOptionalSession();

  const user = sessionData?.user;

  if (!data.isDocumentAccessValid) {
    return <DocumentSigningAuthPageView email={''} emailHasAccount={true} />;
  }

  const { envelope, recipient } = data.envelopeForSigning;

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
  });

  const isEmailForced = derivedRecipientAccessAuth.includes(DocumentAccessAuth.ACCOUNT);

  return (
    <EnvelopeSigningProvider
      envelopeData={data.envelopeForSigning}
      email={isEmailForced ? user?.email || '' : ''} // Doing this allows us to let users change the email if they want to for non-auth templates.
      fullName={user?.name}
      signature={user?.signature}
    >
      <DocumentSigningAuthProvider
        documentAuthOptions={envelope.authOptions}
        recipient={recipient}
        user={user}
      >
        <EnvelopeRenderProvider envelope={envelope} token={recipient.token}>
          <DocumentSigningPageViewV2 />
        </EnvelopeRenderProvider>
      </DocumentSigningAuthProvider>
    </EnvelopeSigningProvider>
  );
};
