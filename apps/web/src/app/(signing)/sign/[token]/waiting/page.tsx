import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Team } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';

type WaitingForTurnToSignPageProps = {
  params: { token?: string };
};

export default async function WaitingForTurnToSignPage({
  params: { token },
}: WaitingForTurnToSignPageProps) {
  await setupI18nSSR();

  if (!token) {
    return notFound();
  }

  const { user } = await getServerComponentSession();

  const [document, recipient] = await Promise.all([
    getDocumentAndSenderByToken({ token }).catch(() => null),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  if (!document || !recipient) {
    return notFound();
  }

  if (document.status === DocumentStatus.COMPLETED) {
    return redirect(`/sign/${token}/complete`);
  }

  let isOwnerOrTeamMember = false;

  let team: Team | null = null;

  if (user) {
    isOwnerOrTeamMember = await getDocumentById({
      id: document.id,
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
          {isOwnerOrTeamMember ? (
            <Button variant="link" asChild>
              <Link href={`${formatDocumentsPath(team?.url)}/${document.id}`}>
                <Trans>Were you trying to edit this document instead?</Trans>
              </Link>
            </Button>
          ) : (
            <Button variant="link" asChild>
              <Link href="/documents">Return Home</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
