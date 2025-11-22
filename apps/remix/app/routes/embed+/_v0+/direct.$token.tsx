import { data } from 'react-router';
import { match } from 'ts-pattern';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeForDirectTemplateSigning } from '@documenso/lib/server-only/envelope/get-envelope-for-direct-template-signing';
import { getEnvelopeRequiredAccessData } from '@documenso/lib/server-only/envelope/get-envelope-required-access-data';
import { getOrganisationClaimByTeamId } from '@documenso/lib/server-only/organisation/get-organisation-claims';
import { getTemplateByDirectLinkToken } from '@documenso/lib/server-only/template/get-template-by-direct-link-token';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';

import { EmbedDirectTemplateClientPage } from '~/components/embed/embed-direct-template-client-page';
import { EmbedSignDocumentV2ClientPage } from '~/components/embed/embed-document-signing-page-v2';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { DocumentSigningRecipientProvider } from '~/components/general/document-signing/document-signing-recipient-provider';
import { EnvelopeSigningProvider } from '~/components/general/document-signing/envelope-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/direct.$token';

async function handleV1Loader({ params, request }: Route.LoaderArgs) {
  if (!params.token) {
    throw new Response('Not found', { status: 404 });
  }

  const token = params.token;

  const template = await getTemplateByDirectLinkToken({
    token,
  }).catch(() => null);

  // `template.directLink` is always available but we're doing this to
  // satisfy the type checker.
  if (!template || !template.directLink) {
    throw new Response('Not found', { status: 404 });
  }

  const organisationClaim = await getOrganisationClaimByTeamId({ teamId: template.teamId });

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

  const { user } = await getOptionalSession(request);

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const isAccessAuthValid = derivedRecipientAccessAuth.every((auth) =>
    match(auth)
      .with(DocumentAccessAuth.ACCOUNT, () => !!user)
      .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => false) // Not supported for direct links
      .exhaustive(),
  );

  if (!isAccessAuthValid) {
    throw data(
      {
        type: 'embed-authentication-required',
        returnTo: `/embed/direct/${token}`,
      },
      {
        status: 401,
      },
    );
  }

  const { directTemplateRecipientId } = template.directLink;

  const recipient = template.recipients.find(
    (recipient) => recipient.id === directTemplateRecipientId,
  );

  if (!recipient) {
    throw new Response('Not found', { status: 404 });
  }

  const fields = template.fields.filter((field) => field.recipientId === directTemplateRecipientId);

  return {
    token,
    user,
    template,
    recipient,
    fields,
    hidePoweredBy,
    allowEmbedSigningWhitelabel,
  };
}

async function handleV2Loader({ params, request }: Route.LoaderArgs) {
  if (!params.token) {
    throw new Response('Not found', { status: 404 });
  }

  const token = params.token;

  const { user } = await getOptionalSession(request);

  const envelopeForSigning = await getEnvelopeForDirectTemplateSigning({
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
        returnTo: `/embed/direct/${token}`,
      },
      {
        status: 401,
      },
    );
  }

  const { envelope, recipient } = envelopeForSigning;

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

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
    recipientAuth: recipient.authOptions,
  });

  const isAccessAuthValid = derivedRecipientAccessAuth.every((accesssAuth) =>
    match(accesssAuth)
      .with(DocumentAccessAuth.ACCOUNT, () => user && user.email === recipient.email)
      .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => false) // Not supported for direct links
      .exhaustive(),
  );

  if (!isAccessAuthValid) {
    throw data(
      {
        type: 'embed-authentication-required',
        email: user?.email || recipient.email,
        returnTo: `/embed/direct/${token}`,
      },
      {
        status: 401,
      },
    );
  }

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
  const foundDirectLink = await prisma.templateDirectLink.findFirst({
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

  if (!foundDirectLink) {
    throw new Response('Not Found', { status: 404 });
  }

  if (foundDirectLink.envelope.internalVersion === 2) {
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

export default function EmbedDirectTemplatePage() {
  const { version, payload } = useSuperLoaderData<typeof loader>();

  if (version === 1) {
    return <EmbedDirectTemplatePageV1 data={payload} />;
  }

  return <EmbedDirectTemplatePageV2 data={payload} />;
}

const EmbedDirectTemplatePageV1 = ({
  data,
}: {
  data: Awaited<ReturnType<typeof handleV1Loader>>;
}) => {
  const { token, user, template, recipient, fields, hidePoweredBy, allowEmbedSigningWhitelabel } =
    data;

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
        recipient={recipient}
        user={user}
      >
        <DocumentSigningRecipientProvider recipient={recipient}>
          <EmbedDirectTemplateClientPage
            token={token}
            envelopeId={template.envelopeId}
            updatedAt={template.updatedAt}
            envelopeItems={template.envelopeItems}
            recipient={recipient}
            fields={fields}
            metadata={template.templateMeta}
            hidePoweredBy={hidePoweredBy}
            allowWhiteLabelling={allowEmbedSigningWhitelabel}
          />
        </DocumentSigningRecipientProvider>
      </DocumentSigningAuthProvider>
    </DocumentSigningProvider>
  );
};

const EmbedDirectTemplatePageV2 = ({
  data,
}: {
  data: Awaited<ReturnType<typeof handleV2Loader>>;
}) => {
  const { token, user, envelopeForSigning, hidePoweredBy, allowEmbedSigningWhitelabel } = data;

  const { envelope, recipient } = envelopeForSigning;

  return (
    <EnvelopeSigningProvider
      envelopeData={envelopeForSigning}
      email={user?.email}
      fullName={user?.name}
      signature={user?.signature}
    >
      <DocumentSigningAuthProvider
        documentAuthOptions={envelope.authOptions}
        recipient={recipient}
        user={user}
        isDirectTemplate={true}
      >
        <EnvelopeRenderProvider envelope={envelope} token={recipient.token}>
          <EmbedSignDocumentV2ClientPage
            hidePoweredBy={hidePoweredBy}
            allowWhitelabelling={allowEmbedSigningWhitelabel}
          />
        </EnvelopeRenderProvider>
      </DocumentSigningAuthProvider>
    </EnvelopeSigningProvider>
  );
};
