import { Trans } from '@lingui/react/macro';
import { AlertTriangleIcon, KeyRoundIcon } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import type { TCachedLicense } from '@documenso/lib/types/license';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type AdminLicenseStatusBannerProps = {
  license: TCachedLicense | null;
};

export const AdminLicenseStatusBanner = ({ license }: AdminLicenseStatusBannerProps) => {
  const licenseStatus = license?.derivedStatus;

  if (!license || licenseStatus === 'ACTIVE') {
    return null;
  }

  return (
    <div
      className={cn('mb-8 rounded-lg bg-yellow-200 text-yellow-900 dark:bg-yellow-400', {
        'bg-destructive text-destructive-foreground':
          licenseStatus === 'EXPIRED' || licenseStatus === 'UNAUTHORIZED',
      })}
    >
      <div className="flex items-center justify-between gap-x-4 px-4 py-3 text-sm font-medium">
        <div className="flex items-center">
          <AlertTriangleIcon className="mr-2.5 h-5 w-5" />

          {match(licenseStatus)
            .with('PAST_DUE', () => (
              <Trans>
                License Payment Overdue - Please update your payment to avoid service disruptions.
              </Trans>
            ))
            .with('EXPIRED', () => (
              <Trans>
                License Expired - Please renew your license to continue using enterprise features.
              </Trans>
            ))
            .with('UNAUTHORIZED', () =>
              license ? (
                <Trans>
                  Invalid License Type - Your Documenso instance is using features that are not part
                  of your license.
                </Trans>
              ) : (
                <Trans>
                  Missing License - Your Documenso instance is using features that require a
                  license.
                </Trans>
              ),
            )
            .otherwise(() => null)}
        </div>

        <Button
          variant="outline"
          size="sm"
          className={cn({
            'border-yellow-900/30 text-yellow-900 hover:bg-yellow-100 dark:hover:bg-yellow-500':
              licenseStatus === 'PAST_DUE',
            'border-destructive-foreground/30 text-destructive-foreground hover:bg-destructive/80':
              licenseStatus === 'EXPIRED' || licenseStatus === 'UNAUTHORIZED',
          })}
          asChild
        >
          <Link to="https://docs.documenso.com/users/licenses/enterprise-edition" target="_blank">
            <KeyRoundIcon className="mr-1.5 h-4 w-4" />
            <Trans>See Documentation</Trans>
          </Link>
        </Button>
      </div>
    </div>
  );
};
