import Link from 'next/link';

import { DateTime } from 'luxon';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import { declineTeamInvitation } from '@documenso/lib/server-only/team/decline-team-invitation';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { prisma } from '@documenso/prisma';
import { TeamMemberInviteStatus } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';

type DeclineInvitationPageProps = {
  params: {
    token: string;
  };
};

export default async function DeclineInvitationPage({
  params: { token },
}: DeclineInvitationPageProps) {
  const session = await getServerComponentSession();

  const teamMemberInvite = await prisma.teamMemberInvite.findUnique({
    where: {
      token,
    },
  });

  if (!teamMemberInvite) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="text-4xl font-semibold">Invalid token</h1>

          <p className="text-muted-foreground mb-4 mt-2 text-sm">
            This token is invalid or has expired. No action is needed.
          </p>

          <Button asChild>
            <Link href="/">Return</Link>
          </Button>
        </div>
      </div>
    );
  }

  const team = await getTeamById({ teamId: teamMemberInvite.teamId });

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: teamMemberInvite.email,
        mode: 'insensitive',
      },
    },
  });

  if (user) {
    await declineTeamInvitation({ userId: user.id, teamId: team.id });
  }

  if (!user && teamMemberInvite.status !== TeamMemberInviteStatus.DECLINED) {
    await prisma.teamMemberInvite.update({
      where: {
        id: teamMemberInvite.id,
      },
      data: {
        status: TeamMemberInviteStatus.DECLINED,
      },
    });
  }

  const email = encryptSecondaryData({
    data: teamMemberInvite.email,
    expiresAt: DateTime.now().plus({ days: 1 }).toMillis(),
  });

  if (!user) {
    return (
      <div>
        <h1 className="text-4xl font-semibold">Team invitation</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          You have been invited by <strong>{team.name}</strong> to join their team.
        </p>

        <p className="text-muted-foreground mb-4 mt-1 text-sm">
          To decline this invitation you must create an account.
        </p>

        <Button asChild>
          <Link href={`/signup?email=${encodeURIComponent(email)}`}>Create account</Link>
        </Button>
      </div>
    );
  }

  const isSessionUserTheInvitedUser = user?.id === session.user?.id;

  return (
    <div className="w-screen max-w-lg px-4">
      <h1 className="text-4xl font-semibold">Invitation declined</h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">
        You have declined the invitation from <strong>{team.name}</strong> to join their team.
      </p>

      {isSessionUserTheInvitedUser ? (
        <Button asChild>
          <Link href="/">Return to Dashboard</Link>
        </Button>
      ) : (
        <Button asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      )}
    </div>
  );
}
