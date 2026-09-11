import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION, SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Trans } from '@lingui/react/macro';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export const OrganisationQuotaBanner = () => {
  const [isOpen, setIsOpen] = useState(false);

  const organisation = useOptionalCurrentOrganisation();

  const { data: quotaFlags } = trpc.organisation.getQuotaFlags.useQuery(
    { organisationId: organisation?.id ?? '' },
    {
      enabled: Boolean(organisation),
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      ...SKIP_QUERY_BATCH_META,
      refetchInterval: 1000 * 60,
      refetchIntervalInBackground: false,
    },
  );

  const isAnyQuotaExceeded = Boolean(
    quotaFlags?.isDocumentQuotaExceeded || quotaFlags?.isEmailQuotaExceeded || quotaFlags?.isApiQuotaExceeded,
  );

  const isAnyQuotaNearing = Boolean(
    quotaFlags?.isDocumentQuotaNearing || quotaFlags?.isEmailQuotaNearing || quotaFlags?.isApiQuotaNearing,
  );

  // Every member of the organisation sees the banner when a quota is exhausted or
  // nearing its limit. When both states apply, "exceeded" wins for the banner copy
  // and the dialog lists both exceeded and nearing items.
  // Note: Skipping free plan banner for now because their quota can incorrectly show as exceeded.
  if (
    !organisation ||
    !quotaFlags ||
    (!isAnyQuotaExceeded && !isAnyQuotaNearing) ||
    organisation.organisationClaim.originalSubscriptionClaimId === INTERNAL_CLAIM_ID.FREE
  ) {
    return null;
  }

  return (
    <>
      <div
        className={cn({
          'bg-yellow-200 text-yellow-900 dark:bg-yellow-400': !isAnyQuotaExceeded,
          'bg-destructive text-destructive-foreground': isAnyQuotaExceeded,
        })}
      >
        <div className="mx-auto flex max-w-screen-xl items-center justify-center gap-x-4 px-4 py-2 font-medium text-sm">
          <div className="flex items-center">
            <AlertTriangle className="mr-2.5 h-5 w-5" />

            {isAnyQuotaExceeded ? (
              <Trans>Your organisation has exceeded a fair use limit</Trans>
            ) : (
              <Trans>Your organisation is approaching a fair use limit</Trans>
            )}
          </div>

          <Button
            variant="outline"
            className={cn({
              'text-yellow-900 hover:bg-yellow-100 dark:hover:bg-yellow-500': !isAnyQuotaExceeded,
              'text-destructive-foreground hover:bg-destructive hover:text-white': isAnyQuotaExceeded,
            })}
            onClick={() => setIsOpen(true)}
            size="sm"
          >
            <Trans>Learn more</Trans>
          </Button>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAnyQuotaExceeded ? <Trans>Fair use limit exceeded</Trans> : <Trans>Approaching fair use limit</Trans>}
            </DialogTitle>

            <DialogDescription>
              {isAnyQuotaExceeded ? (
                <Trans>
                  Your organisation has exceeded a fair use limit. Please contact{' '}
                  <a className="text-primary" href={`mailto:${SUPPORT_EMAIL}`}>
                    support
                  </a>{' '}
                  to review your plan's limits.
                </Trans>
              ) : (
                <Trans>
                  Your organisation is approaching a fair use limit. If you expect to need higher limits, please contact{' '}
                  <a className="text-primary" href={`mailto:${SUPPORT_EMAIL}`}>
                    support
                  </a>{' '}
                  to review your plan's limits.
                </Trans>
              )}
            </DialogDescription>
          </DialogHeader>

          <Alert variant="neutral">
            <AlertDescription>
              <ul className="list-inside list-disc text-sm">
                {quotaFlags.isDocumentQuotaExceeded && (
                  <li className="list-disc">
                    <Trans>Document creation has been temporarily paused</Trans>
                  </li>
                )}
                {quotaFlags.isEmailQuotaExceeded && (
                  <li className="list-disc">
                    <Trans>Email sending has been temporarily paused</Trans>
                  </li>
                )}
                {quotaFlags.isApiQuotaExceeded && (
                  <li className="list-disc">
                    <Trans>API requests have been temporarily paused</Trans>
                  </li>
                )}
                {quotaFlags.isDocumentQuotaNearing && (
                  <li className="list-disc">
                    <Trans>Document usage is approaching fair use limits</Trans>
                  </li>
                )}
                {quotaFlags.isEmailQuotaNearing && (
                  <li className="list-disc">
                    <Trans>Email usage is approaching fair use limits</Trans>
                  </li>
                )}
                {quotaFlags.isApiQuotaNearing && (
                  <li className="list-disc">
                    <Trans>API usage is approaching fair use limits</Trans>
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">
                <Trans>Close</Trans>
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
