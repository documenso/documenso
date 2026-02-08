import { Trans, useLingui } from '@lingui/react/macro';
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  Loader2Icon,
  RefreshCwIcon,
  XCircleIcon,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { Link, useRevalidator } from 'react-router';
import { match } from 'ts-pattern';

import type { TCachedLicense } from '@documenso/lib/types/license';
import { SUBSCRIPTION_CLAIM_FEATURE_FLAGS } from '@documenso/lib/types/subscription';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { CardMetric } from './metric-card';

type AdminLicenseCardProps = {
  licenseData: TCachedLicense | null;
};

export const AdminLicenseCard = ({ licenseData }: AdminLicenseCardProps) => {
  const { t, i18n } = useLingui();

  const { license } = licenseData || {};

  if (!license) {
    return (
      <div className="relative">
        <div className="absolute right-3 top-3 z-10">
          <AdminLicenseResyncButton />
        </div>
        <CardMetric icon={KeyRoundIcon} title={t`License`} className="h-fit max-h-fit">
          <div className="mt-1 flex items-center justify-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50">
              <KeyRoundIcon className="h-5 w-5 text-muted-foreground/50" />
            </div>

            <div className="flex flex-col gap-0.5">
              {licenseData?.requestedLicenseKey ? (
                <>
                  <p className="text-sm font-medium text-destructive">
                    <Trans>Invalid License Key</Trans>
                  </p>
                  <p className="text-xs text-muted-foreground">{licenseData.requestedLicenseKey}</p>
                </>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">
                  <Trans>No License Configured</Trans>
                </p>
              )}

              <Link
                to="https://docs.documenso.com/users/licenses/enterprise-edition"
                target="_blank"
                className="flex flex-row items-center text-xs text-muted-foreground hover:text-muted-foreground/80"
              >
                <Trans>Learn more</Trans> <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </CardMetric>
      </div>
    );
  }

  const enabledFlags = Object.entries(license.flags).filter(([, enabled]) => enabled);

  return (
    <div className="relative max-w-full overflow-hidden rounded-lg border border-border bg-background px-4 pb-6 pt-4 shadow shadow-transparent duration-200 hover:shadow-border/80">
      <div className="absolute right-3 top-3">
        <AdminLicenseResyncButton />
      </div>

      <div className="flex items-start gap-2">
        <div className="h-4 w-4">
          <KeyRoundIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        <h3 className="text-primary-forground mb-2 flex items-end text-sm font-medium leading-tight">
          <Trans>RJUSL Signing License</Trans>
        </h3>

        {match(license.status)
          .with('ACTIVE', () => (
            <Badge variant="default" size="small">
              <CheckCircle2Icon className="mr-1 h-3 w-3" />
              <Trans context="Subscription status">Active</Trans>
            </Badge>
          ))
          .with('PAST_DUE', () => (
            <Badge variant="warning" size="small">
              <XCircleIcon className="mr-1 h-3 w-3" />
              <Trans context="Subscription status">Past Due</Trans>
            </Badge>
          ))
          .with('EXPIRED', () => (
            <Badge variant="destructive" size="small">
              <XCircleIcon className="mr-1 h-3 w-3" />
              <Trans context="Subscription status">Expired</Trans>
            </Badge>
          ))
          .otherwise(() => null)}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            <Trans>License</Trans>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{license.name}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">
            <Trans>Expires</Trans>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {i18n.date(license.periodEnd, DateTime.DATE_MED)}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">
            <Trans>License Key</Trans>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{license.licenseKey}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">
            <Trans>Features</Trans>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {enabledFlags.length > 0 ? (
              enabledFlags
                .map(
                  ([flag]) =>
                    SUBSCRIPTION_CLAIM_FEATURE_FLAGS[
                      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                      flag as keyof typeof SUBSCRIPTION_CLAIM_FEATURE_FLAGS
                    ]?.label || flag,
                )
                .join(', ')
            ) : (
              <Trans>No features enabled</Trans>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

const AdminLicenseResyncButton = () => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { mutate: resyncLicense, isPending: isResyncingLicense } =
    trpc.admin.license.resync.useMutation({
      onSuccess: async () => {
        toast({
          title: t`License synced`,
        });

        await revalidate();
      },
      onError: () => {
        toast({
          title: t`Failed to sync license`,
          variant: 'destructive',
        });
      },
    });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={isResyncingLicense}
            onClick={() => resyncLicense()}
          >
            {isResyncingLicense ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <Trans>Sync license from server</Trans>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
