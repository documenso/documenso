import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { OrganisationMemberInviteStatus } from '@prisma/client';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';

import type { Route } from './+types/organisation.invite.$token';

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  const organisationMemberInvite = await prisma.organisationMemberInvite.findUnique({
    where: {
      token,
    },
    include: {
      organisation: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!organisationMemberInvite) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  const organisationName = organisationMemberInvite.organisation.name;

  if (organisationMemberInvite.status === OrganisationMemberInviteStatus.ACCEPTED) {
    return {
      state: 'AlreadyAccepted',
      organisationName,
    } as const;
  }

  if (organisationMemberInvite.status === OrganisationMemberInviteStatus.DECLINED) {
    return {
      state: 'AlreadyDeclined',
      organisationName,
    } as const;
  }

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: organisationMemberInvite.email,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
    },
  });

  return {
    state: 'Pending',
    token: organisationMemberInvite.token,
    email: organisationMemberInvite.email,
    organisationName,
    userExists: user !== null,
    isSessionUserTheInvitedUser: user !== null && user.id === session.user?.id,
  } as const;
}

export default function AcceptInvitationPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData;

  if (data.state === 'InvalidLink') {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="font-semibold text-4xl">
            <Trans>Invalid token</Trans>
          </h1>

          <p className="mt-2 mb-4 text-muted-foreground text-sm">
            <Trans>This token is invalid or has expired. Please contact your team for a new invitation.</Trans>
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

  if (data.state === 'AlreadyAccepted') {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="font-semibold text-4xl">
            <Trans>Invitation already accepted</Trans>
          </h1>

          <p className="mt-2 mb-4 text-muted-foreground text-sm">
            <Trans>
              You are already a member of <strong>{data.organisationName}</strong>.
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

  if (data.state === 'AlreadyDeclined') {
    return <InvitationDeclined organisationName={data.organisationName} />;
  }

  return (
    <PendingInvitation
      token={data.token}
      email={data.email}
      organisationName={data.organisationName}
      userExists={data.userExists}
      isSessionUserTheInvitedUser={data.isSessionUserTheInvitedUser}
    />
  );
}

type PendingInvitationProps = {
  token: string;
  email: string;
  organisationName: string;
  userExists: boolean;
  isSessionUserTheInvitedUser: boolean;
};

type InvitationResult = 'idle' | 'accepted' | 'declined';

type AcceptFailureReason = 'CapExceeded' | 'SubscriptionInactive' | 'Unknown';

const PendingInvitation = ({
  token,
  email,
  organisationName,
  userExists,
  isSessionUserTheInvitedUser,
}: PendingInvitationProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useOptionalSession();

  const [searchParams] = useSearchParams();
  const actionIsDecline = searchParams.get('action') === 'decline';

  const [result, setResult] = useState<InvitationResult>('idle');
  const [acceptFailureReason, setAcceptFailureReason] = useState<AcceptFailureReason | null>(null);

  const acceptInvitation = trpc.organisation.member.invite.accept.useMutation({
    onSuccess: async () => {
      await refreshSession();

      setResult('accepted');
    },
    onError: (err) => {
      const error = AppError.parseError(err);

      const failureReason = match(error.code)
        .with(AppErrorCode.LIMIT_EXCEEDED, () => 'CapExceeded' as const)
        .with('SUBSCRIPTION_INACTIVE', () => 'SubscriptionInactive' as const)
        .otherwise(() => 'Unknown' as const);

      setAcceptFailureReason(failureReason);
    },
  });

  const declineInvitation = trpc.organisation.member.invite.decline.useMutation({
    onSuccess: async () => {
      await refreshSession();

      setResult('declined');
    },
    onError: () => {
      toast({
        title: t`Something went wrong`,
        description: t`Unable to decline this invitation at this time.`,
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  if (result === 'accepted') {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="font-semibold text-4xl">
            <Trans>Invitation accepted!</Trans>
          </h1>

          <p className="mt-2 mb-4 text-muted-foreground text-sm">
            <Trans>
              You have accepted an invitation from <strong>{organisationName}</strong> to join their organisation.
            </Trans>
          </p>

          {isSessionUserTheInvitedUser ? (
            <Button asChild>
              <Link to="/">
                <Trans>Continue</Trans>
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to={`/signin#email=${encodeURIComponent(email)}`}>
                <Trans>Continue to login</Trans>
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (result === 'declined') {
    return <InvitationDeclined organisationName={organisationName} />;
  }

  // Accepting requires an account (acceptance keys off the invited email).
  // Declining does not, so we only gate account creation on the accept flow.
  if (!actionIsDecline && !userExists) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="font-semibold text-4xl">
            <Trans>Organisation invitation</Trans>
          </h1>

          <p className="mt-2 text-muted-foreground text-sm">
            <Trans>
              You have been invited by <strong>{organisationName}</strong> to join their organisation.
            </Trans>
          </p>

          <p className="mt-1 mb-4 text-muted-foreground text-sm">
            <Trans>To accept this invitation you must create an account.</Trans>
          </p>

          <Button asChild>
            <Link to={`/signup#email=${encodeURIComponent(email)}`}>
              <Trans>Create account</Trans>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isPending = acceptInvitation.isPending || declineInvitation.isPending;

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="font-semibold text-4xl">
          <Trans>Organisation invitation</Trans>
        </h1>

        <p className="mt-2 mb-4 text-muted-foreground text-sm">
          <Trans>
            You have been invited to join <strong>{organisationName}</strong> on Documenso.
          </Trans>
        </p>

        {acceptFailureReason && (
          <p className="mt-2 mb-4 text-destructive text-sm">
            {match(acceptFailureReason)
              .with('CapExceeded', () => (
                <Trans>
                  <strong>{organisationName}</strong> has reached its member limit. Please contact the organisation
                  administrator to upgrade their plan before accepting this invitation.
                </Trans>
              ))
              .with('SubscriptionInactive', () => (
                <Trans>
                  <strong>{organisationName}</strong> does not have an active subscription. Please contact the
                  organisation administrator to renew their plan before accepting this invitation.
                </Trans>
              ))
              .with('Unknown', () => (
                <Trans>
                  We were unable to add you to <strong>{organisationName}</strong> at this time. Please try again later,
                  or contact the organisation administrator.
                </Trans>
              ))
              .exhaustive()}
          </p>
        )}

        <div className="flex items-center gap-x-4">
          <Button
            variant="destructive"
            onClick={async () => declineInvitation.mutateAsync({ token })}
            loading={declineInvitation.isPending}
            disabled={isPending}
          >
            <Trans>Decline</Trans>
          </Button>

          {!actionIsDecline && (
            <Button
              onClick={async () => acceptInvitation.mutateAsync({ token })}
              loading={acceptInvitation.isPending}
              disabled={isPending}
            >
              <Trans>Accept</Trans>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const InvitationDeclined = ({ organisationName }: { organisationName: string }) => {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="font-semibold text-4xl">
          <Trans>Invitation declined</Trans>
        </h1>

        <p className="mt-2 mb-4 text-muted-foreground text-sm">
          <Trans>
            You have declined the invitation from <strong>{organisationName}</strong> to join their organisation.
          </Trans>
        </p>
      </div>
    </div>
  );
};
