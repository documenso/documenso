import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Link } from 'react-router';

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
    select: {
      email: true,
      completed: true,
      expiresAt: true,
      team: {
        select: {
          name: true,
        },
      },
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

  return {
    state: 'Pending',
    token,
    email: teamEmailVerification.email,
    teamName: teamEmailVerification.team.name,
  } as const;
}

export default function VerifyTeamEmailPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData;

  if (data.state === 'InvalidLink') {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="font-semibold text-4xl">
            <Trans>Invalid link</Trans>
          </h1>

          <p className="mt-2 mb-4 text-muted-foreground text-sm">
            <Trans>This link is invalid or has expired. Please contact your team to resend a verification.</Trans>
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
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="font-semibold text-4xl">
            <Trans>Team email already verified!</Trans>
          </h1>

          <p className="mt-2 mb-4 text-muted-foreground text-sm">
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
      </div>
    );
  }

  return <PendingTeamEmailVerification token={data.token} email={data.email} teamName={data.teamName} />;
}

type PendingTeamEmailVerificationProps = {
  token: string;
  email: string;
  teamName: string;
};

const PendingTeamEmailVerification = ({ token, email, teamName }: PendingTeamEmailVerificationProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [isVerified, setIsVerified] = useState(false);

  const { mutateAsync: completeTeamEmailVerification, isPending } = trpc.team.email.verification.complete.useMutation({
    onSuccess: () => setIsVerified(true),
    onError: (err) => {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        toast({
          title: t`Email already in use`,
          description: t`This email is already being used as a team email. Please contact your team for assistance.`,
          variant: 'destructive',
          duration: 10000,
        });

        return;
      }

      toast({
        title: t`Something went wrong`,
        description: t`We were unable to verify this email at this time. Please try again later.`,
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  if (isVerified) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="font-semibold text-4xl">
            <Trans>Team email verified!</Trans>
          </h1>

          <p className="mt-2 mb-4 text-muted-foreground text-sm">
            <Trans>
              You have verified your email address for <strong>{teamName}</strong>.
            </Trans>
          </p>

          <Button asChild>
            <Link to="/">
              <Trans>Continue</Trans>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="font-semibold text-4xl">
          <Trans>Verify team email</Trans>
        </h1>

        <p className="mt-2 text-muted-foreground text-sm">
          <Trans>
            <strong>{teamName}</strong> would like to use <strong>{email}</strong> as their team email.
          </Trans>
        </p>

        <p className="mt-2 text-muted-foreground text-sm">
          <Trans>They will be able to view documents associated with this email.</Trans>
        </p>

        <p className="mt-2 mb-4 text-muted-foreground text-sm">
          <Trans>Do not proceed if you are unsure about this request.</Trans>
        </p>

        <Button loading={isPending} onClick={async () => completeTeamEmailVerification({ token })}>
          <Trans>Verify email</Trans>
        </Button>
      </div>
    </div>
  );
};
