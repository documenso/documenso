import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

import type { Route } from './+types/team.verify.email.$token';

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;

  if (!token) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  const teamEmailVerification = await prisma.teamEmailVerification.findUnique({
    where: {
      token,
    },
    include: {
      team: true,
    },
  });

  if (!teamEmailVerification || isTokenExpired(teamEmailVerification.expiresAt)) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  if (teamEmailVerification.completed) {
    return {
      state: 'AlreadyCompleted',
      teamName: teamEmailVerification.team.name,
    } as const;
  }

  const { team } = teamEmailVerification;

  let isTeamEmailVerificationError = false;

  try {
    await prisma.$transaction([
      prisma.teamEmailVerification.updateMany({
        where: {
          teamId: team.id,
          email: teamEmailVerification.email,
        },
        data: {
          completed: true,
        },
      }),
      prisma.teamEmailVerification.deleteMany({
        where: {
          teamId: team.id,
          expiresAt: {
            lt: new Date(),
          },
        },
      }),
      prisma.teamEmail.create({
        data: {
          teamId: team.id,
          email: teamEmailVerification.email,
          name: teamEmailVerification.name,
        },
      }),
    ]);
  } catch (e) {
    console.error(e);
    isTeamEmailVerificationError = true;
  }

  if (isTeamEmailVerificationError) {
    return {
      state: 'VerificationError',
      teamName: team.name,
    } as const;
  }

  return {
    state: 'Success',
    teamName: team.name,
  } as const;
}

export default function VerifyTeamEmailPage({ loaderData }: Route.ComponentProps) {
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
              This link is invalid or has expired. Please contact your team to resend a
              verification.
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
          <Trans>Team email already verified!</Trans>
        </h1>

        <p className="text-muted-foreground mb-4 mt-2 text-sm">
          <Trans>
            You have already verified your email address for <strong>{data.teamName}</strong>.
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

  if (data.state === 'VerificationError') {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Team email verification</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            Something went wrong while attempting to verify your email address for{' '}
            <strong>{data.teamName}</strong>. Please try again later.
          </Trans>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-semibold">
        <Trans>Team email verified!</Trans>
      </h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">
        <Trans>
          You have verified your email address for <strong>{data.teamName}</strong>.
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
