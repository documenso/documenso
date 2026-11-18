import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { ShieldBanIcon } from 'lucide-react';
import { Link } from 'react-router';

/**
 * Intentionally shows no title, sender or branding since the content itself may be the abuse.
 */
export const DocumentSigningSenderDisabledPage = () => {
  const { sessionData } = useOptionalSession();
  const user = sessionData?.user;

  return (
    <div className="flex flex-col items-center pt-24 lg:pt-36 xl:pt-44">
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-x-4">
          <ShieldBanIcon className="h-10 w-10 text-destructive" />

          <h2 className="max-w-[35ch] text-center font-semibold text-2xl leading-normal md:text-3xl lg:text-4xl">
            <Trans>Sender Account Disabled</Trans>
          </h2>
        </div>

        <p className="mt-6 max-w-[60ch] text-center text-muted-foreground text-sm">
          <Trans>
            This document is no longer available to sign because the account that sent it has been disabled, likely due
            to spam or abuse.
          </Trans>
        </p>

        <p className="mt-2 max-w-[60ch] text-center text-muted-foreground text-sm">
          <Trans>If you believe this is a mistake, please contact the sender directly.</Trans>
        </p>

        {user && (
          <Button className="mt-6" asChild>
            <Link to="/">
              <Trans>Return Home</Trans>
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};
