import { useLayoutEffect } from 'react';

import { Outlet, useLoaderData } from 'react-router';

import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getOrganisationClaimByTeamId } from '@documenso/lib/server-only/organisation/get-organisation-claims';
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

  let allowEmbedAuthoringWhiteLabel = false;

  if (result) {
    const organisationClaim = await getOrganisationClaimByTeamId({
      teamId: result.teamId,
    });

    allowEmbedAuthoringWhiteLabel = organisationClaim.flags.embedAuthoringWhiteLabel ?? false;
  }

  return {
    token,
    hasValidToken: !!result,
    allowEmbedAuthoringWhiteLabel,
  };
};

export default function AuthoringLayout() {
  const { token, hasValidToken, allowEmbedAuthoringWhiteLabel } = useLoaderData<typeof loader>();

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

      if (allowEmbedAuthoringWhiteLabel) {
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
