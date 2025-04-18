import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { transferTeamOwnership } from '@documenso/lib/server-only/team/transfer-team-ownership';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

import type { Route } from './+types/team.verify.transfer.$token';

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;

  if (!token) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  const teamTransferVerification = await prisma.teamTransferVerification.findUnique({
    where: {
      token,
    },
    include: {
      team: true,
    },
  });

  if (!teamTransferVerification || isTokenExpired(teamTransferVerification.expiresAt)) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  if (teamTransferVerification.completed) {
    return {
      state: 'AlreadyCompleted',
      teamName: teamTransferVerification.team.name,
    } as const;
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
    return {
      state: 'TransferError',
      teamName: team.name,
    } as const;
  }

  return {
    state: 'Success',
    teamName: team.name,
    teamUrl: team.url,
  } as const;
}

export default function VerifyTeamTransferPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData;

  if (data.state === 'InvalidLink') {
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
            <Link to="/">
              <Trans>Return</Trans>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (data.state === 'AlreadyCompleted') {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Team ownership transfer already completed!</Trans>
        </h1>

        <p className="text-muted-foreground mb-4 mt-2 text-sm">
          <Trans>
            You have already completed the ownership transfer for <strong>{data.teamName}</strong>.
          </Trans>
        </p>

        <Button asChild>
          <Link to="/">
            <Trans>Continue</Trans>
          </Link>
        </Button>
      </div>
    );
  }

  if (data.state === 'TransferError') {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Team ownership transfer</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            Something went wrong while attempting to transfer the ownership of team{' '}
            <strong>{data.teamName}</strong> to your. Please try again later or contact support.
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
          The ownership of team <strong>{data.teamName}</strong> has been successfully transferred
          to you.
        </Trans>
      </p>

      <Button asChild>
        <Link to={`/t/${data.teamUrl}/settings`}>
          <Trans>Continue</Trans>
        </Link>
      </Button>
    </div>
  );
}
