import { Trans } from '@lingui/react/macro';
import { TeamMemberInviteStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { Link } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import { declineTeamInvitation } from '@documenso/lib/server-only/team/decline-team-invitation';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

import type { Route } from './+types/team.decline.$token';

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  const teamMemberInvite = await prisma.teamMemberInvite.findUnique({
    where: {
      token,
    },
  });

  if (!teamMemberInvite) {
    return {
      state: 'InvalidLink',
    } as const;
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
    return {
      state: 'LoginRequired',
      email,
      teamName: team.name,
    } as const;
  }

  const isSessionUserTheInvitedUser = user.id === session?.user?.id;

  return {
    state: 'Success',
    email,
    teamName: team.name,
    isSessionUserTheInvitedUser,
  } as const;
}

export default function DeclineInvitationPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData;

  if (data.state === 'InvalidLink') {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="text-4xl font-semibold">
            <Trans>Invalid token</Trans>
          </h1>

          <p className="text-muted-foreground mb-4 mt-2 text-sm">
            <Trans>This token is invalid or has expired. No action is needed.</Trans>
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

  if (data.state === 'LoginRequired') {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Team invitation</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            You have been invited by <strong>{data.teamName}</strong> to join their team.
          </Trans>
        </p>

        <p className="text-muted-foreground mb-4 mt-1 text-sm">
          <Trans>To decline this invitation you must create an account.</Trans>
        </p>

        <Button asChild>
          <Link to={`/signup?email=${encodeURIComponent(data.email)}`}>
            <Trans>Create account</Trans>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <h1 className="text-4xl font-semibold">
        <Trans>Invitation declined</Trans>
      </h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">
        <Trans>
          You have declined the invitation from <strong>{data.teamName}</strong> to join their team.
        </Trans>
      </p>

      {data.isSessionUserTheInvitedUser ? (
        <Button asChild>
          <Link to="/">
            <Trans>Return to Dashboard</Trans>
          </Link>
        </Button>
      ) : (
        <Button asChild>
          <Link to="/">
            <Trans>Return to Home</Trans>
          </Link>
        </Button>
      )}
    </div>
  );
}
