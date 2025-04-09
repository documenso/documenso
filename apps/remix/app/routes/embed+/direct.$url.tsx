import { data } from 'react-router';
import { match } from 'ts-pattern';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { isCommunityPlan as isUserCommunityPlan } from '@documenso/ee/server-only/util/is-community-plan';
import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { isDocumentPlatform } from '@documenso/ee/server-only/util/is-document-platform';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { getTemplateByDirectLinkToken } from '@documenso/lib/server-only/template/get-template-by-direct-link-token';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';

import { EmbedDirectTemplateClientPage } from '~/components/embed/embed-direct-template-client-page';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { DocumentSigningRecipientProvider } from '~/components/general/document-signing/document-signing-recipient-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/direct.$url';

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!params.url) {
    throw new Response('Not found', { status: 404 });
  }

  const token = params.url;

  const template = await getTemplateByDirectLinkToken({
    token,
  }).catch(() => null);

  // `template.directLink` is always available but we're doing this to
  // satisfy the type checker.
  if (!template || !template.directLink) {
    throw new Response('Not found', { status: 404 });
  }

  // TODO: Make this more robust, we need to ensure the owner is either
  // TODO: the member of a team that has an active subscription, is an early
  // TODO: adopter or is an enterprise user.
  if (IS_BILLING_ENABLED() && !template.teamId) {
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

  const [isPlatformDocument, isEnterpriseDocument, isCommunityPlan] = await Promise.all([
    isDocumentPlatform(template),
    isUserEnterprise({
      userId: template.userId,
      teamId: template.teamId ?? undefined,
    }),
    isUserCommunityPlan({
      userId: template.userId,
      teamId: template.teamId ?? undefined,
    }),
  ]);

  const isAccessAuthValid = match(derivedRecipientAccessAuth)
    .with(DocumentAccessAuth.ACCOUNT, () => user !== null)
    .with(null, () => true)
    .exhaustive();

  if (!isAccessAuthValid) {
    throw data(
      {
        type: 'embed-authentication-required',
        email: user?.email,
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

  const team = template.teamId
    ? await getTeamById({ teamId: template.teamId, userId: template.userId }).catch(() => null)
    : null;

  const hidePoweredBy = team?.teamGlobalSettings?.brandingHidePoweredBy ?? false;

  return superLoaderJson({
    token,
    user,
    template,
    recipient,
    fields,
    hidePoweredBy,
    isPlatformDocument,
    isEnterpriseDocument,
    isCommunityPlan,
  });
}

export default function EmbedDirectTemplatePage() {
  const {
    token,
    user,
    template,
    recipient,
    fields,
    hidePoweredBy,
    isPlatformDocument,
    isEnterpriseDocument,
    isCommunityPlan,
  } = useSuperLoaderData<typeof loader>();

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
            updatedAt={template.updatedAt}
            documentData={template.templateDocumentData}
            recipient={recipient}
            fields={fields}
            metadata={template.templateMeta}
            hidePoweredBy={
              isCommunityPlan || isPlatformDocument || isEnterpriseDocument || hidePoweredBy
            }
            allowWhiteLabelling={isCommunityPlan || isPlatformDocument || isEnterpriseDocument}
          />
        </DocumentSigningRecipientProvider>
      </DocumentSigningAuthProvider>
    </DocumentSigningProvider>
  );
}
