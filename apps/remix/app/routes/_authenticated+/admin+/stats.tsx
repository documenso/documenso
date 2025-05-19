import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  File,
  FileCheck,
  FileClock,
  FileCog,
  FileEdit,
  Mail,
  MailOpen,
  PenTool,
  UserPlus,
  UserSquare2,
  Users,
} from 'lucide-react';

import { getDocumentStats } from '@documenso/lib/server-only/admin/get-documents-stats';
import { getRecipientsStats } from '@documenso/lib/server-only/admin/get-recipients-stats';
import {
  getOrganisationsWithSubscriptionsCount,
  getUsersCount,
} from '@documenso/lib/server-only/admin/get-users-stats';
import { getSignerConversionMonthly } from '@documenso/lib/server-only/user/get-signer-conversion';

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
    // userWithAtLeastOneDocumentPerMonth,
    // userWithAtLeastOneDocumentSignedPerMonth,
    // MONTHLY_USERS_SIGNED,
  ] = await Promise.all([
    getUsersCount(),
    getOrganisationsWithSubscriptionsCount(),
    getDocumentStats(),
    getRecipientsStats(),
    getSignerConversionMonthly(),
    // getUserWithAtLeastOneDocumentPerMonth(),
    // getUserWithAtLeastOneDocumentSignedPerMonth(),
    // getUserWithSignedDocumentMonthlyGrowth(),
  ]);

  return {
    usersCount,
    organisationsWithSubscriptionsCount,
    docStats,
    recipientStats,
    signerConversionMonthly,
    // MONTHLY_USERS_SIGNED,
  };
}

export default function AdminStatsPage({ loaderData }: Route.ComponentProps) {
  const { _ } = useLingui();

  const {
    usersCount,
    organisationsWithSubscriptionsCount,
    docStats,
    recipientStats,
    signerConversionMonthly,
    // MONTHLY_USERS_SIGNED,
  } = loaderData;

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
          <AdminStatsUsersWithDocumentsChart
            data={[]}
            // data={MONTHLY_USERS_SIGNED}
            title={_(msg`MAU (created document)`)}
            tooltip={_(msg`Monthly Active Users: Users that created at least one Document`)}
          />
          <AdminStatsUsersWithDocumentsChart
            data={[]}
            // data={MONTHLY_USERS_SIGNED}
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
