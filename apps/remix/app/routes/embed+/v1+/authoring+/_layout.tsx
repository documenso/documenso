import { useLayoutEffect } from 'react';

import { Outlet, useLoaderData } from 'react-router';

import { isCommunityPlan } from '@documenso/ee/server-only/util/is-community-plan';
import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { isDocumentPlatform } from '@documenso/ee/server-only/util/is-document-platform';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { TrpcProvider } from '@documenso/trpc/react';

import { ZBaseEmbedAuthoringSchema } from '~/types/embed-authoring-base-schema';
import { injectCss } from '~/utils/css-vars';

import type { Route } from './+types/_layout';

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  const token = url.searchParams.get('token');

  if (!token) {
    return {
      hasValidToken: false,
      token,
    };
  }

  const result = await verifyEmbeddingPresignToken({ token }).catch(() => null);

  let hasPlatformPlan = false;
  let hasEnterprisePlan = false;
  let hasCommunityPlan = false;

  if (result) {
    [hasCommunityPlan, hasPlatformPlan, hasEnterprisePlan] = await Promise.all([
      isCommunityPlan({
        userId: result.userId,
        teamId: result.teamId ?? undefined,
      }),
      isDocumentPlatform({
        userId: result.userId,
        teamId: result.teamId,
      }),
      isUserEnterprise({
        userId: result.userId,
        teamId: result.teamId ?? undefined,
      }),
    ]);
  }

  return {
    hasValidToken: !!result,
    token,
    hasCommunityPlan,
    hasPlatformPlan,
    hasEnterprisePlan,
  };
};

export default function AuthoringLayout() {
  const { hasValidToken, token, hasCommunityPlan, hasPlatformPlan, hasEnterprisePlan } =
    useLoaderData<typeof loader>();

  useLayoutEffect(() => {
    try {
      const hash = window.location.hash.slice(1);

      const result = ZBaseEmbedAuthoringSchema.safeParse(
        JSON.parse(decodeURIComponent(atob(hash))),
      );

      if (!result.success) {
        return;
      }

      const { css, cssVars, darkModeDisabled } = result.data;

      if (darkModeDisabled) {
        document.documentElement.classList.add('dark-mode-disabled');
      }

      if (hasCommunityPlan || hasPlatformPlan || hasEnterprisePlan) {
        injectCss({
          css,
          cssVars,
        });
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  if (!hasValidToken) {
    return <div>Invalid embedding presign token provided</div>;
  }

  return (
    <TrpcProvider headers={{ authorization: `Bearer ${token}` }}>
      <Outlet />
    </TrpcProvider>
  );
}
