import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Trans, useLingui } from '@lingui/react/macro';
import { ClockIcon, MailIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';

type SignupInviteStatusCardProps = {
  email: string;
  expiresAt: string;
  variant?: 'default' | 'embedded';
};

const EXPIRING_SOON_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export const SignupInviteStatusCard = ({ email, expiresAt, variant = 'default' }: SignupInviteStatusCardProps) => {
  const { i18n } = useLingui();
  const [relativeExpiry, setRelativeExpiry] = useState<string | null>(null);

  const expiresAtDate = new Date(expiresAt);
  const msUntilExpiry = expiresAtDate.getTime() - Date.now();
  const isExpiringSoon = msUntilExpiry > 0 && msUntilExpiry <= EXPIRING_SOON_THRESHOLD_MS;

  useEffect(() => {
    const updateRelativeExpiry = () => {
      setRelativeExpiry(DateTime.fromJSDate(expiresAtDate).toRelative());
    };

    updateRelativeExpiry();

    const intervalId = window.setInterval(updateRelativeExpiry, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [expiresAt]);

  return (
    <div
      className={cn(
        variant === 'default' && 'mb-6 rounded-xl border border-border bg-background p-4',
        variant === 'embedded' && 'w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-sm',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-medium text-foreground text-sm">
          <Trans>Invitation details</Trans>
        </p>

        <Badge variant={isExpiringSoon ? 'neutral' : 'default'} size="small">
          {isExpiringSoon ? <Trans>Expiring soon</Trans> : <Trans>Active</Trans>}
        </Badge>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-3">
          <MailIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-muted-foreground text-xs">
              <Trans>Invited email</Trans>
            </p>
            <p className="font-medium text-foreground">{email}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <ClockIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-muted-foreground text-xs">
              <Trans>Expires</Trans>
            </p>
            <p className="font-medium text-foreground">
              {i18n.date(expiresAtDate, {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            </p>
            {relativeExpiry && (
              <p className="text-muted-foreground text-xs">
                <Trans>Expires {relativeExpiry}</Trans>
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-muted-foreground text-xs">
        <Trans>Invitations are single-use and expire automatically.</Trans>
      </p>
    </div>
  );
};
