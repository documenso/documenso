import Link from 'next/link';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { transferTeamOwnership } from '@documenso/lib/server-only/team/transfer-team-ownership';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

type VerifyTeamTransferPage = {
  params: {
    token: string;
  };
};

export default async function VerifyTeamTransferPage({
  params: { token },
}: VerifyTeamTransferPage) {
  await setupI18nSSR();

  const teamTransferVerification = await prisma.teamTransferVerification.findUnique({
    where: {
      token,
    },
    include: {
      team: true,
    },
  });

  if (!teamTransferVerification || isTokenExpired(teamTransferVerification.expiresAt)) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="text-4xl font-semibold">
            <Trans>Invalid link</Trans>
          </h1>

          <p className="text-muted-foreground mb-4 mt-2 text-sm">
            <Trans>
              This link is invalid or has expired. Please contact your team to resend a transfer
              request.
            </Trans>
          </p>

          <Button asChild>
            <Link href="/">
              <Trans>Return</Trans>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (teamTransferVerification.completed) {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Team ownership transfer already completed!</Trans>
        </h1>

        <p className="text-muted-foreground mb-4 mt-2 text-sm">
          <Trans>
            You have already completed the ownership transfer for{' '}
            <strong>{teamTransferVerification.team.name}</strong>.
          </Trans>
        </p>

        <Button asChild>
          <Link href="/">
            <Trans>Continue</Trans>
          </Link>
        </Button>
      </div>
    );
  }

  const { team } = teamTransferVerification;

  let isTransferError = false;

  try {
    await transferTeamOwnership({ token });
  } catch (e) {
    console.error(e);
    isTransferError = true;
  }

  if (isTransferError) {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Team ownership transfer</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            Something went wrong while attempting to transfer the ownership of team{' '}
            <strong>{team.name}</strong> to your. Please try again later or contact support.
          </Trans>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-semibold">
        <Trans>Team ownership transferred!</Trans>
      </h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">
        <Trans>
          The ownership of team <strong>{team.name}</strong> has been successfully transferred to
          you.
        </Trans>
      </p>

      <Button asChild>
        <Link href={`/t/${team.url}/settings`}>
          <Trans>Continue</Trans>
        </Link>
      </Button>
    </div>
  );
}
