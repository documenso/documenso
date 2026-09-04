import { Trans } from '@lingui/react/macro';

import { SignupInviteStatusCard } from '~/components/general/signup-invite/signup-invite-status-card';

type SignupInviteSidePanelProps = {
  email: string;
  expiresAt: string;
};

export const SignupInviteSidePanel = ({ email, expiresAt }: SignupInviteSidePanelProps) => {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center gap-8">
      <div className="rounded-2xl border bg-background px-4 py-1 font-medium text-sm">
        <Trans>Invitation-only signup</Trans>
      </div>

      <div className="space-y-3">
        <h1 className="font-semibold text-2xl md:text-3xl">
          <Trans>You&apos;ve been invited to create a Documenso account</Trans>
        </h1>

        <p className="text-muted-foreground text-sm md:text-base">
          <Trans>Complete the form to create your account using this invitation.</Trans>
        </p>
      </div>

      <SignupInviteStatusCard email={email} expiresAt={expiresAt} variant="embedded" />
    </div>
  );
};
