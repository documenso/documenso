import Link from 'next/link';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

type VerifyTeamEmailPageProps = {
  params: {
    token: string;
  };
};

export default async function VerifyTeamEmailPage({ params: { token } }: VerifyTeamEmailPageProps) {
  await setupI18nSSR();

  const teamEmailVerification = await prisma.teamEmailVerification.findUnique({
    where: {
      token,
    },
    include: {
      team: true,
    },
  });

  if (!teamEmailVerification || isTokenExpired(teamEmailVerification.expiresAt)) {
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
            <Link href="/">
              <Trans>Return</Trans>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (teamEmailVerification.completed) {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Team email already verified!</Trans>
        </h1>

        <p className="text-muted-foreground mb-4 mt-2 text-sm">
          <Trans>
            You have already verified your email address for{' '}
            <strong>{teamEmailVerification.team.name}</strong>.
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
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Team email verification</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>
            Something went wrong while attempting to verify your email address for{' '}
            <strong>{team.name}</strong>. Please try again later.
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
          You have verified your email address for <strong>{team.name}</strong>.
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
