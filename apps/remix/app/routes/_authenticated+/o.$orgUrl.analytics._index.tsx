import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { formatAnalyticsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { trpc } from '@documenso/trpc/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { OrganisationMemberRole } from '@prisma/client';
import { keepPreviousData } from '@tanstack/react-query';
import { UsersIcon } from 'lucide-react';
import { redirect } from 'react-router';

import type { AnalyticsActivityRow } from '~/components/general/analytics/analytics-activity-table-card';
import { AnalyticsActivityTableCard } from '~/components/general/analytics/analytics-activity-table-card';
import { AnalyticsDocumentsOverTimeCard } from '~/components/general/analytics/analytics-documents-over-time-card';
import { AnalyticsHydrateFallback } from '~/components/general/analytics/analytics-hydrate-fallback';
import { AnalyticsNoActivityAlert } from '~/components/general/analytics/analytics-no-activity-alert';
import { AnalyticsOverviewCards } from '~/components/general/analytics/analytics-overview-cards';
import { AnalyticsPageHeader } from '~/components/general/analytics/analytics-page-header';
import { AnalyticsStatusBreakdownCard } from '~/components/general/analytics/analytics-status-breakdown-card';
import { AnalyticsTemplateUsageCard } from '~/components/general/analytics/analytics-template-usage-card';
import { resolveBrowserTimezone, useAnalyticsRange } from '~/utils/analytics';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/o.$orgUrl.analytics._index';

export function meta() {
  return appMetaTags(msg`Analytics`);
}

/**
 * Organisation analytics are restricted to organisation admins (not managers),
 * matching the tRPC procedures.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request);

  const organisation = await prisma.organisation.findFirst({
    where: {
      ...buildOrganisationWhereQuery({
        organisationId: undefined,
        userId: session.user.id,
        roles: [OrganisationMemberRole.ADMIN],
      }),
      url: params.orgUrl,
    },
    select: { id: true },
  });

  if (!organisation) {
    throw redirect(`/o/${params.orgUrl}`);
  }

  return {};
}

/**
 * The timezone is read from the browser so the analytics queries only run on the
 * client, after hydration, with the correct day boundaries.
 */
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  await serverLoader();

  return { timezone: resolveBrowserTimezone() };
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return <AnalyticsHydrateFallback />;
}

export default function OrganisationAnalyticsPage({ loaderData }: Route.ComponentProps) {
  const organisation = useCurrentOrganisation();
  const { _ } = useLingui();
  const { timezone } = loaderData;

  const { value: range, rangeKey, setValue: setRange } = useAnalyticsRange();

  // `from`/`to` are only present for custom ranges.
  const queryInput = { organisationId: organisation.id, timezone, ...range };
  const queryOptions = { placeholderData: keepPreviousData };

  const overviewQuery = trpc.organisation.analytics.getOverview.useQuery(queryInput, queryOptions);
  const documentsOverTimeQuery = trpc.organisation.analytics.getDocumentsOverTime.useQuery(queryInput, queryOptions);
  const statusBreakdownQuery = trpc.organisation.analytics.getStatusBreakdown.useQuery(queryInput, queryOptions);
  const templateUsageQuery = trpc.organisation.analytics.getTemplateUsage.useQuery(
    { ...queryInput, limit: TEMPLATE_LIMIT },
    queryOptions,
  );
  const teamActivityQuery = trpc.organisation.analytics.getTeamActivity.useQuery(queryInput, queryOptions);

  const hasNoActivity =
    overviewQuery.isSuccess &&
    !overviewQuery.isPlaceholderData &&
    documentsOverTimeQuery.isSuccess &&
    !documentsOverTimeQuery.isPlaceholderData &&
    overviewQuery.data.sent.current === 0 &&
    overviewQuery.data.sent.previous === 0 &&
    documentsOverTimeQuery.data.total === 0;

  const teamRows: AnalyticsActivityRow[] = (teamActivityQuery.data?.teams ?? []).map((team) => ({
    key: team.id,
    avatar: { imageId: team.avatarImageId, fallback: team.name.slice(0, 1).toUpperCase() },
    title: team.name,
    subtitle: `/t/${team.url}`,
    sent: team.sent,
    completed: team.completed,
    pending: team.pending,
    completionRate: team.completionRate,
    lastActiveAt: team.lastActiveAt,
    href: formatAnalyticsPath(team.url),
  }));

  return (
    <div>
      <AnalyticsPageHeader
        avatarImageId={organisation.avatarImageId}
        name={organisation.name}
        range={range}
        onRangeChange={setRange}
      />

      {hasNoActivity && (
        <AnalyticsNoActivityAlert range={range.range} onShowLastYear={() => setRange({ range: '12m' })} />
      )}

      <div className="mt-6 flex flex-col gap-4">
        <AnalyticsOverviewCards
          query={overviewQuery}
          entity={{
            icon: UsersIcon,
            title: <Trans>Teams</Trans>,
            testId: 'analytics-teams',
            select: (data) => data.teams,
          }}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <AnalyticsDocumentsOverTimeCard range={range} query={documentsOverTimeQuery} className="lg:col-span-2" />
          <AnalyticsStatusBreakdownCard query={statusBreakdownQuery} />
        </div>

        <AnalyticsTemplateUsageCard
          query={templateUsageQuery}
          getTemplateHref={(template) =>
            template.team !== null && template.envelopeId !== null
              ? `${formatTemplatesPath(template.team.url)}/${template.envelopeId}`
              : null
          }
          renderTemplateMeta={(template) => template.team?.name}
        />

        <AnalyticsActivityTableCard
          query={teamActivityQuery}
          rows={teamRows}
          rangeKey={rangeKey}
          title={<Trans>Team activity</Trans>}
          description={<Trans>Documents sent by each team in this period</Trans>}
          columnLabel={<Trans>Team</Trans>}
          renderSummary={(count, activeCount) => (
            <>
              <Plural value={count} one="# team" other="# teams" /> · <Trans>{activeCount} active this period</Trans>
            </>
          )}
          renderShowing={(visibleCount, totalCount) => (
            <Trans>
              Showing {visibleCount} of {totalCount} teams
            </Trans>
          )}
          emptyLabel={<Trans>No teams</Trans>}
          searchPlaceholder={_(msg`Search teams`)}
          noSearchResultsLabel={<Trans>No teams match your search</Trans>}
          testIdPrefix="team"
        />
      </div>
    </div>
  );
}

const TEMPLATE_LIMIT = 5;
