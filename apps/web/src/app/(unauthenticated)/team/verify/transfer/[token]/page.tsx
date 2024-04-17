import Link from 'next/link';

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
          <h1 className="text-4xl font-semibold">Invalid link</h1>

          <p className="text-muted-foreground mb-4 mt-2 text-sm">
            This link is invalid or has expired. Please contact your team to resend a transfer
            request.
          </p>

          <Button asChild>
            <Link href="/">Return</Link>
          </Button>
        </div>
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
        <h1 className="text-4xl font-semibold">Team ownership transfer</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          Something went wrong while attempting to transfer the ownership of team{' '}
          <strong>{team.name}</strong> to your. Please try again later or contact support.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-semibold">Team ownership transferred!</h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">
        The ownership of team <strong>{team.name}</strong> has been successfully transferred to you.
      </p>

      <Button asChild>
        <Link href={`/t/${team.url}/settings`}>Continue</Link>
      </Button>
    </div>
  );
}
