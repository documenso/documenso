import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  File,
  FileCheck,
  FileClock,
  FileCog,
  FileEdit,
  KeyRoundIcon,
  Mail,
  MailOpen,
  PenTool,
  UserPlus,
  UserSquare2,
  Users,
  XCircleIcon,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { getDocumentStats } from '@documenso/lib/server-only/admin/get-documents-stats';
import { getRecipientsStats } from '@documenso/lib/server-only/admin/get-recipients-stats';
import {
  getMonthlyActiveUsers,
  getOrganisationsWithSubscriptionsCount,
  getUserWithSignedDocumentMonthlyGrowth,
  getUsersCount,
} from '@documenso/lib/server-only/admin/get-users-stats';
import { getLicense } from '@documenso/lib/server-only/license/get-license';
import { getSignerConversionMonthly } from '@documenso/lib/server-only/user/get-signer-conversion';
import { SUBSCRIPTION_CLAIM_FEATURE_FLAGS } from '@documenso/lib/types/subscription';
import { Badge } from '@documenso/ui/primitives/badge';

import { MonthlyActiveUsersChart } from '~/components/general/admin-monthly-active-user-charts';
import { AdminStatsSignerConversionChart } from '~/components/general/admin-stats-signer-conversion-chart';
import { AdminStatsUsersWithDocumentsChart } from '~/components/general/admin-stats-users-with-documents';
import { CardMetric } from '~/components/general/metric-card';

import { version } from '../../../../package.json';
import type { Route } from './+types/stats';

export async function loader() {
  const [
    usersCount,
    organisationsWithSubscriptionsCount,
    docStats,
    recipientStats,
    signerConversionMonthly,
    monthlyUsersWithDocuments,
    monthlyActiveUsers,
    licenseData,
  ] = await Promise.all([
    getUsersCount(),
    getOrganisationsWithSubscriptionsCount(),
    getDocumentStats(),
    getRecipientsStats(),
    getSignerConversionMonthly(),
    getUserWithSignedDocumentMonthlyGrowth(),
    getMonthlyActiveUsers(),
    getLicense(),
  ]);

  return {
    usersCount,
    organisationsWithSubscriptionsCount,
    docStats,
    recipientStats,
    signerConversionMonthly,
    monthlyUsersWithDocuments,
    monthlyActiveUsers,
    licenseData,
  };
}

export default function AdminStatsPage({ loaderData }: Route.ComponentProps) {
  const { _, i18n } = useLingui();

  const {
    usersCount,
    organisationsWithSubscriptionsCount,
    docStats,
    recipientStats,
    signerConversionMonthly,
    monthlyUsersWithDocuments,
    monthlyActiveUsers,
    licenseData,
  } = loaderData;

  const { license } = licenseData || {};

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Instance Stats</Trans>
      </h2>

      <div className="mt-8 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CardMetric icon={Users} title={_(msg`Total Users`)} value={usersCount} />
        <CardMetric icon={File} title={_(msg`Total Documents`)} value={docStats.ALL} />
        <CardMetric
          icon={UserPlus}
          title={_(msg`Active Subscriptions`)}
          value={organisationsWithSubscriptionsCount}
        />

        <CardMetric icon={FileCog} title={_(msg`App Version`)} value={`v${version}`} />
      </div>

      <div className="mb-8 mt-4">
        {license ? (
          <div className="max-w-full overflow-hidden rounded-lg border border-border bg-background px-4 pb-6 pt-4 shadow shadow-transparent duration-200 hover:shadow-border/80">
            <div className="flex items-start gap-2">
              <div className="h-4 w-4">
                <KeyRoundIcon className="h-4 w-4 text-muted-foreground" />
              </div>

              <h3 className="text-primary-forground mb-2 flex items-end text-sm font-medium leading-tight">
                <Trans>Documenso License</Trans>
              </h3>

              {match(license.status)
                .with('ACTIVE', () => (
                  <Badge variant="default" size="small">
                    <CheckCircle2Icon className="mr-1 h-3 w-3" />
                    <Trans>Active</Trans>
                  </Badge>
                ))
                .with('PAST_DUE', () => (
                  <Badge variant="warning" size="small">
                    <XCircleIcon className="mr-1 h-3 w-3" />
                    <Trans>Past Due</Trans>
                  </Badge>
                ))
                .with('EXPIRED', () => (
                  <Badge variant="destructive" size="small">
                    <XCircleIcon className="mr-1 h-3 w-3" />
                    <Trans>Expired</Trans>
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
                  {license.flags && Object.keys(license.flags).length > 0
                    ? Object.entries(license.flags)
                        .filter(([, enabled]) => enabled)
                        .map(
                          ([flag]) =>
                            SUBSCRIPTION_CLAIM_FEATURE_FLAGS[
                              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                              flag as keyof typeof SUBSCRIPTION_CLAIM_FEATURE_FLAGS
                            ]?.label || flag,
                        )
                        .join(', ')
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        ) : licenseData?.requestedLicenseKey ? (
          <CardMetric icon={KeyRoundIcon} title={_(msg`License`)} className="h-fit max-h-fit">
            <div className="mt-1 flex items-center justify-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50">
                <KeyRoundIcon className="h-5 w-5 text-muted-foreground/50" />
              </div>

              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-destructive">
                  <Trans>Invalid License Key</Trans>
                </p>
                <p className="text-xs text-muted-foreground">{licenseData.requestedLicenseKey}</p>

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
        ) : (
          <CardMetric icon={KeyRoundIcon} title={_(msg`License`)} className="h-fit max-h-fit">
            <div className="mt-1 flex items-center justify-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50">
                <KeyRoundIcon className="h-5 w-5 text-muted-foreground/50" />
              </div>

              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-muted-foreground">
                  <Trans>No License Configured</Trans>
                </p>

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
        )}
      </div>

      <div className="mt-16 gap-8">
        <div>
          <h3 className="text-3xl font-semibold">
            <Trans>Document metrics</Trans>
          </h3>

          <div className="mb-8 mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <CardMetric icon={FileEdit} title={_(msg`Drafted Documents`)} value={docStats.DRAFT} />
            <CardMetric
              icon={FileClock}
              title={_(msg`Pending Documents`)}
              value={docStats.PENDING}
            />
            <CardMetric
              icon={FileCheck}
              title={_(msg`Completed Documents`)}
              value={docStats.COMPLETED}
            />
          </div>
        </div>

        <div>
          <h3 className="text-3xl font-semibold">
            <Trans>Recipients metrics</Trans>
          </h3>

          <div className="mb-8 mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <CardMetric
              icon={UserSquare2}
              title={_(msg`Total Recipients`)}
              value={recipientStats.TOTAL_RECIPIENTS}
            />
            <CardMetric
              icon={Mail}
              title={_(msg`Documents Received`)}
              value={recipientStats.SENT}
            />
            <CardMetric
              icon={MailOpen}
              title={_(msg`Documents Viewed`)}
              value={recipientStats.OPENED}
            />
            <CardMetric
              icon={PenTool}
              title={_(msg`Signatures Collected`)}
              value={recipientStats.SIGNED}
            />
          </div>
        </div>
      </div>

      <div className="mt-16">
        <h3 className="text-3xl font-semibold">
          <Trans>Charts</Trans>
        </h3>
        <div className="mt-5 grid grid-cols-2 gap-8">
          <MonthlyActiveUsersChart title={_(msg`MAU (signed in)`)} data={monthlyActiveUsers} />

          <AdminStatsUsersWithDocumentsChart
            data={monthlyUsersWithDocuments}
            title={_(msg`MAU (created document)`)}
            tooltip={_(msg`Monthly Active Users: Users that created at least one Document`)}
          />
          <AdminStatsUsersWithDocumentsChart
            data={monthlyUsersWithDocuments}
            completed
            title={_(msg`MAU (had document completed)`)}
            tooltip={_(
              msg`Monthly Active Users: Users that had at least one of their documents completed`,
            )}
          />
          <AdminStatsSignerConversionChart
            title="Signers that Signed Up"
            data={signerConversionMonthly}
          />
          <AdminStatsSignerConversionChart
            title={_(msg`Total Signers that Signed Up`)}
            data={signerConversionMonthly}
            cummulative
          />
        </div>
      </div>
    </div>
  );
}
