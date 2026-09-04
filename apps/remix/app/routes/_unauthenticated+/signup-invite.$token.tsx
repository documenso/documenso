import { getSignupInviteByToken } from '@documenso/lib/server-only/signup-invite/get-signup-invite-by-token';
import { prisma } from '@documenso/prisma';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { SignupInviteStatus } from '@prisma/client';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { SignUpForm } from '~/components/forms/signup';
import { SignupInviteStatusCard } from '~/components/general/signup-invite/signup-invite-status-card';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signup-invite.$token';

export function meta() {
  return appMetaTags(msg`Create account`);
}

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;

  if (!token) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  const invite = await getSignupInviteByToken(token);

  if (!invite) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  if (invite.status === SignupInviteStatus.EXPIRED) {
    return {
      state: 'Expired',
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
    } as const;
  }

  if (invite.status === SignupInviteStatus.ACCEPTED) {
    return {
      state: 'AlreadyAccepted',
      email: invite.email,
    } as const;
  }

  if (invite.status === SignupInviteStatus.REVOKED) {
    return {
      state: 'Revoked',
      email: invite.email,
    } as const;
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: invite.email,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    return {
      state: 'UserExists',
      email: invite.email,
    } as const;
  }

  return {
    state: 'Pending',
    token: invite.token,
    email: invite.email,
    expiresAt: invite.expiresAt.toISOString(),
  } as const;
}

export default function SignupInvitePage({ loaderData }: Route.ComponentProps) {
  if (loaderData.state === 'InvalidLink') {
    return (
      <InviteMessage
        title={<Trans>Invalid invitation</Trans>}
        description={
          <Trans>This invitation link is invalid. Please contact your administrator for a new invite.</Trans>
        }
      />
    );
  }

  if (loaderData.state === 'Expired') {
    return (
      <InviteMessage
        title={<Trans>Invitation expired</Trans>}
        description={
          <Trans>
            The invitation for <strong>{loaderData.email}</strong> expired on{' '}
            {new Date(loaderData.expiresAt).toLocaleString()}. Please contact your administrator for a new invite.
          </Trans>
        }
      />
    );
  }

  if (loaderData.state === 'AlreadyAccepted') {
    return (
      <InviteMessage
        title={<Trans>Invitation already used</Trans>}
        description={
          <Trans>
            An account has already been created for <strong>{loaderData.email}</strong>.
          </Trans>
        }
        action={
          <Button asChild>
            <Link to={`/signin#email=${encodeURIComponent(loaderData.email)}`}>
              <Trans>Sign in</Trans>
            </Link>
          </Button>
        }
      />
    );
  }

  if (loaderData.state === 'Revoked') {
    return (
      <InviteMessage
        title={<Trans>Invitation revoked</Trans>}
        description={
          <Trans>
            The invitation for <strong>{loaderData.email}</strong> is no longer valid. Please contact your
            administrator.
          </Trans>
        }
      />
    );
  }

  if (loaderData.state === 'UserExists') {
    return (
      <InviteMessage
        title={<Trans>Account already exists</Trans>}
        description={
          <Trans>
            An account already exists for <strong>{loaderData.email}</strong>.
          </Trans>
        }
        action={
          <Button asChild>
            <Link to={`/signin#email=${encodeURIComponent(loaderData.email)}`}>
              <Trans>Sign in</Trans>
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="w-full max-w-lg px-4">
      <Alert className="mb-6">
        <AlertTitle>
          <Trans>You&apos;ve been invited to create a Documenso account</Trans>
        </AlertTitle>
        <AlertDescription>
          <Trans>Complete the form below to create your account using this invitation.</Trans>
        </AlertDescription>
      </Alert>

      <SignupInviteStatusCard email={loaderData.email} expiresAt={loaderData.expiresAt} />

      <SignUpForm
        className="w-full max-w-lg"
        hideMarketingPanel
        hideSocialSignup
        isEmailPasswordSignupEnabled
        inviteToken={loaderData.token}
        lockedEmail={loaderData.email}
        initialEmail={loaderData.email}
      />
    </div>
  );
}

type InviteMessageProps = {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
};

const InviteMessage = ({ title, description, action }: InviteMessageProps) => {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="font-semibold text-4xl">{title}</h1>

        <p className="mt-2 mb-4 text-muted-foreground text-sm">{description}</p>

        {action ?? (
          <Button asChild>
            <Link to="/signin">
              <Trans>Go to sign in</Trans>
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};
