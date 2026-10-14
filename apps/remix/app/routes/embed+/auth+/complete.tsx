import {
  EMBED_AUTH_MESSAGE_COMPLETE,
  EMBED_AUTH_MESSAGE_FAILED,
  ZEmbedAuthCompleteStatusSchema,
} from '@documenso/lib/constants/embed-auth';
import { Trans } from '@lingui/react/macro';
import { useEffect } from 'react';

import { BrandingLogo } from '~/components/general/branding-logo';

import type { Route } from './+types/complete';

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  const parsedStatus = ZEmbedAuthCompleteStatusSchema.safeParse(url.searchParams.get('status'));

  const status = parsedStatus.success ? parsedStatus.data : 'error';

  return {
    status,
  };
}

/**
 * `window.opener` is frequently null here: COOP-enforcing IdPs (Google) sever
 * the opener link permanently. The iframe is polling redeem regardless, so the
 * messages are only accelerators. `window.close()` still works either way.
 */
export default function EmbedAuthCompletePage({ loaderData }: Route.ComponentProps) {
  const { status } = loaderData;

  useEffect(() => {
    const opener: Window | null = window.opener;

    if (status !== 'ok') {
      if (opener) {
        opener.postMessage({ type: EMBED_AUTH_MESSAGE_FAILED }, window.location.origin);
      }

      return;
    }

    if (opener) {
      opener.postMessage({ type: EMBED_AUTH_MESSAGE_COMPLETE }, window.location.origin);
    }

    window.close();
  }, [status]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-y-8 px-6">
      <BrandingLogo className="h-6 w-auto" />

      {status === 'ok' ? (
        <p className="text-center text-muted-foreground text-sm">
          <Trans>You can close this window.</Trans>
        </p>
      ) : (
        <p className="text-center text-destructive text-sm">
          <Trans>Sign in did not complete. Close this window and try again.</Trans>
        </p>
      )}
    </div>
  );
}
