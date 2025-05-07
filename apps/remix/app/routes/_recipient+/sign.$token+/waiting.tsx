import { Trans } from '@lingui/react/macro';
import type { Team } from '@prisma/client';
import { DocumentStatus } from '@prisma/client';
import { Link, redirect } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { Button } from '@documenso/ui/primitives/button';

import type { Route } from './+types/waiting';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { user } = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    throw new Response('Not Found', { status: 404 });
  }

  const [document, recipient] = await Promise.all([
    getDocumentAndSenderByToken({ token }).catch(() => null),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  if (!document || !recipient) {
    throw new Response('Not Found', { status: 404 });
  }

  if (document.status === DocumentStatus.COMPLETED) {
    throw redirect(`/sign/${token}/complete`);
  }

  let isOwnerOrTeamMember = false;

  let team: Team | null = null;

  if (user) {
    isOwnerOrTeamMember = await getDocumentById({
      documentId: document.id,
      userId: user.id,
      teamId: document.teamId ?? undefined,
    })
      .then((document) => !!document)
      .catch(() => false);

    if (document.teamId) {
      team = await getTeamById({
        userId: user.id,
        teamId: document.teamId,
      });
    }
  }

  const documentPathForEditing = isOwnerOrTeamMember
    ? formatDocumentsPath(team?.url) + '/' + document.id
    : null;

  return {
    documentPathForEditing,
  };
}

export default function WaitingForTurnToSignPage({ loaderData }: Route.ComponentProps) {
  const { documentPathForEditing } = loaderData;

  return (
    <div className="relative flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md text-center">
        <h2 className="tracking-tigh text-3xl font-bold">
          <Trans>Waiting for Your Turn</Trans>
        </h2>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            It's currently not your turn to sign. You will receive an email with instructions once
            it's your turn to sign the document.
          </Trans>
        </p>

        <p className="text-muted-foreground mt-4 text-sm">
          <Trans>Please check your email for updates.</Trans>
        </p>

        <div className="mt-4">
          {documentPathForEditing ? (
            <Button variant="link" asChild>
              <Link to={documentPathForEditing}>
                <Trans>Were you trying to edit this document instead?</Trans>
              </Link>
            </Button>
          ) : (
            <Button variant="link" asChild>
              <Link to="/">Return Home</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
