import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { canAccessOrganisationAnalytics, formatOrganisationAnalyticsPath } from '@documenso/lib/utils/organisations';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { canExecuteTeamAction, formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { keepPreviousData } from '@tanstack/react-query';
import { ArrowRightIcon, UsersIcon } from 'lucide-react';
import { Link, redirect } from 'react-router';

import type { AnalyticsActivityRow } from '~/components/general/analytics/analytics-activity-table-card';
import { AnalyticsActivityTableCard } from '~/components/general/analytics/analytics-activity-table-card';
import { AnalyticsDocumentsOverTimeCard } from '~/components/general/analytics/analytics-documents-over-time-card';
import { AnalyticsHydrateFallback } from '~/components/general/analytics/analytics-hydrate-fallback';
import { AnalyticsNoActivityAlert } from '~/components/general/analytics/analytics-no-activity-alert';
import { AnalyticsOverviewCards } from '~/components/general/analytics/analytics-overview-cards';
import { AnalyticsPageHeader } from '~/components/general/analytics/analytics-page-header';
import { AnalyticsStatusBreakdownCard } from '~/components/general/analytics/analytics-status-breakdown-card';
import { AnalyticsTemplateUsageCard } from '~/components/general/analytics/analytics-template-usage-card';
import { useCurrentTeam } from '~/providers/team';
import { resolveBrowserTimezone, useAnalyticsRange } from '~/utils/analytics';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/analytics._index';

export function meta() {
  return appMetaTags(msg`Analytics`);
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request);
  // `getTeamByUrl` throws when the user isn't a member; treat that like any other
  // denial so the documents route renders its "Team not found" state instead of a 500.
  const team = await getTeamByUrl({ userId: session.user.id, teamUrl: params.teamUrl }).catch(() => null);

  if (!team || !canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole)) {
    throw redirect(formatDocumentsPath(params.teamUrl));
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

export default function TeamAnalyticsPage({ loaderData }: Route.ComponentProps) {
  const team = useCurrentTeam();
  const { _ } = useLingui();
  const organisation = useCurrentOrganisation();
  const { timezone } = loaderData;

  const { value: range, rangeKey, setValue: setRange } = useAnalyticsRange();

  // `from`/`to` are only present for custom ranges.
  const queryInput = { teamId: team.id, timezone, ...range };
  const queryOptions = { placeholderData: keepPreviousData };

  const overviewQuery = trpc.team.analytics.getOverview.useQuery(queryInput, queryOptions);
  const documentsOverTimeQuery = trpc.team.analytics.getDocumentsOverTime.useQuery(queryInput, queryOptions);
  const statusBreakdownQuery = trpc.team.analytics.getStatusBreakdown.useQuery(queryInput, queryOptions);
  const templateUsageQuery = trpc.team.analytics.getTemplateUsage.useQuery(
    { ...queryInput, limit: TEMPLATE_LIMIT },
    queryOptions,
  );
  const memberActivityQuery = trpc.team.analytics.getMemberActivity.useQuery(queryInput, queryOptions);

  const hasNoActivity =
    overviewQuery.isSuccess &&
    !overviewQuery.isPlaceholderData &&
    documentsOverTimeQuery.isSuccess &&
    !documentsOverTimeQuery.isPlaceholderData &&
    overviewQuery.data.sent.current === 0 &&
    overviewQuery.data.sent.previous === 0 &&
    documentsOverTimeQuery.data.total === 0;

  const templatesPath = formatTemplatesPath(team.url);

  const memberRows: AnalyticsActivityRow[] = (memberActivityQuery.data?.members ?? []).map((member) => ({
    key: member.userId,
    avatar: { imageId: member.avatarImageId, fallback: formatMemberInitials(member.name, member.email) },
    title: member.name || member.email,
    subtitle: member.name ? member.email : null,
    sent: member.sent,
    completed: member.completed,
    pending: member.pending,
    completionRate: member.completionRate,
    lastActiveAt: member.lastActiveAt,
  }));

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <AnalyticsPageHeader
        className="mt-8"
        avatarImageId={team.avatarImageId}
        name={team.name}
        range={range}
        onRangeChange={setRange}
        actions={
          canAccessOrganisationAnalytics(organisation.currentOrganisationRole) && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link to={formatOrganisationAnalyticsPath(organisation.url)}>
                <Trans>View organisation analytics</Trans>
                <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          )
        }
      />

      {hasNoActivity && (
        <AnalyticsNoActivityAlert range={range.range} onShowLastYear={() => setRange({ range: '12m' })} />
      )}

      <div className="mt-6 flex flex-col gap-4">
        <AnalyticsOverviewCards
          query={overviewQuery}
          entity={{
            icon: UsersIcon,
            title: <Trans>Members</Trans>,
            testId: 'analytics-members',
            select: (data) => data.members,
          }}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <AnalyticsDocumentsOverTimeCard range={range} query={documentsOverTimeQuery} className="lg:col-span-2" />
          <AnalyticsStatusBreakdownCard query={statusBreakdownQuery} />
        </div>

        <AnalyticsTemplateUsageCard
          query={templateUsageQuery}
          templatesHref={templatesPath}
          getTemplateHref={(template) =>
            template.envelopeId !== null ? `${templatesPath}/${template.envelopeId}` : null
          }
        />

        <AnalyticsActivityTableCard
          query={memberActivityQuery}
          rows={memberRows}
          rangeKey={rangeKey}
          title={<Trans>Member activity</Trans>}
          description={<Trans>Documents sent by each member in this period</Trans>}
          columnLabel={<Trans>Member</Trans>}
          renderSummary={(count, activeCount) => (
            <>
              <Plural value={count} one="# member" other="# members" /> ·{' '}
              <Trans>{activeCount} active this period</Trans>
            </>
          )}
          renderShowing={(visibleCount, totalCount) => (
            <Trans>
              Showing {visibleCount} of {totalCount} members
            </Trans>
          )}
          emptyLabel={<Trans>No members</Trans>}
          searchPlaceholder={_(msg`Search members`)}
          noSearchResultsLabel={<Trans>No members match your search</Trans>}
          testIdPrefix="member"
        />
      </div>
    </div>
  );
}

const TEMPLATE_LIMIT = 5;

const formatMemberInitials = (name: string | null, email: string) => {
  const initials = name ? extractInitials(name) : '';

  return initials || email.slice(0, 1).toUpperCase();
};
