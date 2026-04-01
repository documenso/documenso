import { useLayoutEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { Outlet, useLoaderData } from 'react-router';

import { APP_I18N_OPTIONS } from '@documenso/lib/constants/i18n';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getOrganisationClaimByTeamId } from '@documenso/lib/server-only/organisation/get-organisation-claims';
import { ZBaseEmbedAuthoringSchema } from '@documenso/lib/types/embed-authoring-base-schema';
import { dynamicActivate } from '@documenso/lib/utils/i18n';
import { TrpcProvider } from '@documenso/trpc/react';
import { Spinner } from '@documenso/ui/primitives/spinner';

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

  const [hasFinishedInit, setHasFinishedInit] = useState(false);

  useLayoutEffect(() => {
    try {
      const hash = window.location.hash.slice(1);

      const result = ZBaseEmbedAuthoringSchema.safeParse(
        JSON.parse(decodeURIComponent(atob(hash))),
      );

      if (!result.success) {
        setHasFinishedInit(true);
        return;
      }

      const { css, cssVars, darkModeDisabled, language } = result.data;

      if (darkModeDisabled) {
        document.documentElement.classList.add('dark-mode-disabled');
      }

      if (allowEmbedAuthoringWhiteLabel) {
        injectCss({
          css,
          cssVars,
        });
      }

      if (language && language !== APP_I18N_OPTIONS.sourceLang) {
        void dynamicActivate(language).finally(() => {
          setHasFinishedInit(true);
        });
      } else {
        setHasFinishedInit(true);
      }
    } catch (error) {
      console.error(error);
      setHasFinishedInit(true);
    }
  }, []);

  if (!hasFinishedInit) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!hasValidToken) {
    return (
      <div>
        <Trans>Invalid embedding presign token provided</Trans>
      </div>
    );
  }

  return (
    <TrpcProvider headers={{ authorization: `Bearer ${token}` }}>
      <Outlet />
    </TrpcProvider>
  );
}
