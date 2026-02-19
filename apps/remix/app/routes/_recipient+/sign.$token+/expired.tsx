import { Trans } from '@lingui/react/macro';
import { TimerOffIcon } from 'lucide-react';
import { Link } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { isRecipientAuthorized } from '@documenso/lib/server-only/document/is-recipient-authorized';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';

import { DocumentSigningAuthPageView } from '~/components/general/document-signing/document-signing-auth-page';
import { truncateTitle } from '~/utils/truncate-title';

import type { Route } from './+types/expired';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { user } = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    throw new Response('Not Found', { status: 404 });
  }

  const document = await getDocumentAndSenderByToken({
    token,
    requireAccessAuth: false,
  }).catch(() => null);

  if (!document) {
    throw new Response('Not Found', { status: 404 });
  }

  const title = document.title;

  const recipient = await getRecipientByToken({ token }).catch(() => null);

  if (!recipient) {
    throw new Response('Not Found', { status: 404 });
  }

  const isDocumentAccessValid = await isRecipientAuthorized({
    type: 'ACCESS',
    documentAuthOptions: document.authOptions,
    recipient,
    userId: user?.id,
  });

  const recipientEmail = recipient.email;

  if (isDocumentAccessValid) {
    return {
      isDocumentAccessValid: true,
      recipientEmail,
      title,
    };
  }

  return {
    isDocumentAccessValid: false,
    recipientEmail,
  };
}

export default function ExpiredSigningPage({ loaderData }: Route.ComponentProps) {
  const { sessionData } = useOptionalSession();
  const user = sessionData?.user;

  const { isDocumentAccessValid, recipientEmail, title } = loaderData;

  if (!isDocumentAccessValid) {
    return <DocumentSigningAuthPageView email={recipientEmail} />;
  }

  return (
    <div className="flex flex-col items-center pt-24 lg:pt-36 xl:pt-44">
      <Badge
        variant="neutral"
        size="default"
        title={title}
        className="mb-6 rounded-xl border bg-transparent"
      >
        {truncateTitle(title ?? '')}
      </Badge>

      <div className="flex flex-col items-center">
        <div className="flex items-center gap-x-4">
          <TimerOffIcon className="h-10 w-10 text-orange-500" />

          <h2 className="max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
            <Trans>Document Expired</Trans>
          </h2>
        </div>

        <div className="mt-4 flex items-center text-center text-sm text-orange-500">
          <Trans>This document has expired</Trans>
        </div>

        <p className="mt-6 max-w-[60ch] text-center text-sm text-muted-foreground">
          <Trans>
            The signing deadline for this document has passed. Please contact the document owner if
            you need a new copy to sign.
          </Trans>
        </p>

        <p className="mt-2 max-w-[60ch] text-center text-sm text-muted-foreground">
          <Trans>No further action is required from you at this time.</Trans>
        </p>

        {user && (
          <Button className="mt-6" asChild>
            <Link to={`/`}>
              <Trans>Return Home</Trans>
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
