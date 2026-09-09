import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { IS_TEAM_ANALYTICS_ENABLED } from '@documenso/lib/constants/app';
import { SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { type AnalyticsPeriod, resolveAnalyticsPeriod } from '@documenso/lib/utils/analytics-period';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { canExecuteTeamAction, formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { ZGetTeamAnalyticsRequestSchema } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { keepPreviousData, skipToken } from '@tanstack/react-query';
import {
  BanIcon,
  BirdIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileCheckIcon,
  FileClockIcon,
  FileEditIcon,
  FileXIcon,
  SendIcon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import { DateTime, IANAZone } from 'luxon';
import { parseAsString, useQueryStates } from 'nuqs';
import { Link, redirect, replace } from 'react-router';

import { FilterPill } from '~/components/general/filter-pill';
import { CardMetric } from '~/components/general/metric-card';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/analytics._index';

export function meta() {
  return appMetaTags(msg`Analytics`);
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request);
  const team = await getTeamByUrl({ userId: session.user.id, teamUrl: params.teamUrl });

  if (!IS_TEAM_ANALYTICS_ENABLED() || !team || !canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole)) {
    throw redirect(formatDocumentsPath(params.teamUrl));
  }

  return {};
}

export async function clientLoader({ request, serverLoader }: Route.ClientLoaderArgs) {
  await serverLoader();
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localTimezone = IANAZone.isValidZone(browserTimezone) ? browserTimezone : 'UTC';
  const url = new URL(request.url);

  if (!url.searchParams.has('period') || !url.searchParams.has('date') || !url.searchParams.has('timezone')) {
    const timezone = url.searchParams.get('timezone') ?? localTimezone;
    const today = DateTime.now().setZone(IANAZone.isValidZone(timezone) ? timezone : localTimezone);
    url.searchParams.set('period', url.searchParams.get('period') ?? 'month');
    url.searchParams.set('date', url.searchParams.get('date') ?? today.toFormat('yyyy-MM-dd'));
    url.searchParams.set('timezone', timezone);
    throw replace(`${url.pathname}?${url.searchParams}`);
  }

  return { localTimezone };
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return (
    <div role="status" aria-live="polite" data-testid="analytics-loading">
      <SpinnerBox />
      <span className="sr-only">
        <Trans>Loading analytics</Trans>
      </span>
    </div>
  );
}

export default function TeamAnalyticsPage({ loaderData }: Route.ComponentProps) {
  const team = useCurrentTeam();
  const { _, i18n } = useLingui();
  const { localTimezone } = loaderData;
  const [filters, setFilters] = useQueryStates(
    { period: parseAsString, date: parseAsString, timezone: parseAsString, senderIds: parseAsString },
    { history: 'push' },
  );
  const parsed = ZGetTeamAnalyticsRequestSchema.safeParse({
    teamId: team.id,
    period: filters.period,
    date: filters.date,
    timezone: filters.timezone,
    senderIds: filters.senderIds ? filters.senderIds.split(',').map(Number) : [],
  });
  let period: AnalyticsPeriod | undefined;
  let periodError: AppError | undefined;

  if (parsed.success) {
    try {
      period = resolveAnalyticsPeriod(parsed.data);
    } catch (err) {
      periodError = AppError.parseError(err);
    }
  }

  const analytics = trpc.team.getAnalytics.useQuery(parsed.success && period ? parsed.data : skipToken, {
    retry: false,
    gcTime: 0,
    staleTime: 0,
    placeholderData: keepPreviousData,
    trpc: { ...SKIP_QUERY_BATCH_META.trpc, abortOnUnmount: true },
  });
  const error = analytics.error ? AppError.parseError(analytics.error) : periodError;
  const isInvalidFilter =
    !parsed.success ||
    !!periodError ||
    error?.code === AppErrorCode.INVALID_REQUEST ||
    analytics.error?.data?.code === 'BAD_REQUEST';
  const isAccessDenied =
    error?.code === AppErrorCode.UNAUTHORIZED ||
    error?.code === AppErrorCode.FORBIDDEN ||
    error?.code === AppErrorCode.NOT_FOUND ||
    analytics.error?.data?.code === 'UNAUTHORIZED' ||
    analytics.error?.data?.code === 'FORBIDDEN';
  const isLoading = !isInvalidFilter && !error && (analytics.isPending || analytics.isFetching);
  const data = !isLoading && !isInvalidFilter && !error ? analytics.data : undefined;
  const selectedOwners = parsed.success ? (parsed.data.senderIds ?? []) : [];
  const activeTimezone = filters.timezone ?? localTimezone;
  const today = DateTime.now().setZone(activeTimezone);
  const localToday = DateTime.now().setZone(localTimezone).toISODate();
  const start = period ? DateTime.fromJSDate(period.start, { zone: period.timezone }) : undefined;
  const previousDate = start && period ? start.minus({ [`${period.unit}s`]: 1 }).toISODate() : null;
  const nextDate = start && period ? start.plus({ [`${period.unit}s`]: 1 }) : undefined;
  const isCurrentWindow =
    start !== undefined &&
    period !== undefined &&
    start.toMillis() === DateTime.now().setZone(period.timezone).startOf(period.unit).toMillis();
  const hasActiveFilters =
    filters.period !== 'month' || !isCurrentWindow || activeTimezone !== localTimezone || !!filters.senderIds;
  const isEmptyTeam = data !== undefined && !data.hasDocuments && selectedOwners.length === 0;
  const hasActivity = data !== undefined && Object.values(data.activity).some((count) => count > 0);
  const coverageLabels = data
    ? ACTIVITY_METRICS.filter(({ key }) => data.incompleteMetrics.includes(key))
        .map(({ label }) => _(label))
        .join(', ')
    : '';
  const windowLabel = period ? formatWindow(period, WINDOW_FORMATS[period.unit], i18n.locale) : '';
  const rangeLabel = period ? formatWindow(period, WINDOW_FORMATS.day, i18n.locale) : '';

  const resetFilters = () => {
    void setFilters({ period: 'month', date: localToday, timezone: localTimezone, senderIds: null });
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="mt-8 flex flex-row items-center">
        <Avatar className="mr-3 h-12 w-12 border-2 border-white border-solid dark:border-border">
          {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
          <AvatarFallback className="text-muted-foreground text-xs">{team.name.slice(0, 1)}</AvatarFallback>
        </Avatar>

        <h2 className="font-semibold text-4xl">
          <Trans>Analytics</Trans>
        </h2>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-4">
        <FilterPill
          icon={CalendarIcon}
          label={<Trans>Period</Trans>}
          value={filters.period}
          options={PERIOD_OPTIONS}
          onChange={(value) => void setFilters({ period: value ?? 'month' })}
          clearable={false}
          testId="analytics-period"
        />

        <div className="flex items-center gap-x-1">
          <Button
            variant="outline"
            className="w-10 px-0"
            aria-label={_(msg`Previous period`)}
            disabled={!previousDate}
            onClick={() => void setFilters({ date: previousDate })}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>

          <div
            className="flex h-10 min-w-40 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-3 font-medium text-sm tabular-nums"
            data-testid="analytics-date"
          >
            {windowLabel}
          </div>

          <Button
            variant="outline"
            className="w-10 px-0"
            aria-label={_(msg`Next period`)}
            disabled={!nextDate || nextDate > today}
            onClick={() => void setFilters({ date: nextDate?.toISODate() ?? null })}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>

        <FilterPill
          multiple
          icon={UserIcon}
          label={<Trans>Owner</Trans>}
          value={selectedOwners.map(String)}
          options={(analytics.data?.owners ?? []).map((owner) => ({
            value: String(owner.id),
            label: owner.name || owner.email,
          }))}
          onChange={(values) => void setFilters({ senderIds: values.length ? values.join(',') : null })}
          enableSearch
          searchPlaceholder={_(msg`Search owners`)}
          loading={!analytics.data}
          testId="analytics-owner-filter"
        />

        {hasActiveFilters && (
          <Button variant="ghost" className="px-2 text-muted-foreground lg:px-3" onClick={resetFilters}>
            <Trans>Reset</Trans>
            <XIcon className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-8">
        {isAccessDenied ? (
          <Alert variant="neutral" data-testid="analytics-error">
            <AlertDescription>
              <p>
                <Trans>Analytics is no longer available for this team or your role.</Trans>
              </p>
              <Button asChild variant="outline" className="mt-3">
                <Link to={formatDocumentsPath(team.url)}>
                  <Trans>Back to documents</Trans>
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : isInvalidFilter ? (
          <Alert variant="neutral" data-testid="analytics-error">
            <AlertDescription>
              <Trans>
                These filters are not valid. Reset them, then choose a past or current period, a valid timezone, and an
                available owner.
              </Trans>
            </AlertDescription>
          </Alert>
        ) : error ? (
          <Alert variant="neutral" data-testid="analytics-error">
            <AlertDescription>
              <p>
                <Trans>Analytics could not load. Try again or choose a shorter period.</Trans>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void analytics.refetch()}>
                  <Trans>Retry</Trans>
                </Button>
                {period && period.unit !== 'day' && (
                  <Button
                    variant="outline"
                    onClick={() => void setFilters({ period: period.unit === 'year' ? 'month' : 'day' })}
                  >
                    <Trans>Use a shorter period</Trans>
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        ) : isEmptyTeam ? (
          <div
            className="flex flex-col items-center justify-center gap-y-4 py-16 text-center"
            data-testid="analytics-empty"
          >
            <BirdIcon className="h-12 w-12 text-muted-foreground/60" strokeWidth={1.5} />

            <div className="text-muted-foreground/60">
              <h3 className="font-semibold text-lg">
                <Trans>No documents yet</Trans>
              </h3>

              <p className="mt-2 max-w-[60ch]">
                <Trans>Send a document to start tracking your team's activity.</Trans>
              </p>
            </div>

            <Button asChild variant="outline">
              <Link to={formatDocumentsPath(team.url)}>
                <Trans>Send a document</Trans>
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <section>
              <h3 className="font-semibold text-xl">
                <Trans>Activity</Trans>
              </h3>

              <p className="mt-1 text-muted-foreground text-sm">
                {rangeLabel} · {activeTimezone}
              </p>

              {coverageLabels && (
                <Alert variant="neutral" role="status" className="mt-4" data-testid="analytics-coverage">
                  <AlertDescription>
                    <Trans>
                      Some activity dates are unavailable. These activity totals can be incomplete: {coverageLabels}.
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {ACTIVITY_METRICS.map(({ key, icon, label }) => (
                  <CardMetric
                    key={key}
                    icon={icon}
                    title={_(label)}
                    value={data?.activity[key]}
                    testId={`analytics-${key}`}
                  >
                    {!data && <Skeleton className="mt-auto h-8 w-16" />}
                  </CardMetric>
                ))}
              </div>

              {data && !hasActivity && (
                <p className="mt-4 text-muted-foreground text-sm" data-testid="analytics-empty">
                  <Trans>No document activity in this period.</Trans>
                </p>
              )}
            </section>

            <section className="mt-10">
              <h3 className="font-semibold text-xl">
                <Trans>Current documents</Trans>
              </h3>

              <p className="mt-1 text-muted-foreground text-sm">
                <Trans>Not affected by the date filter.</Trans>
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {CURRENT_METRICS.map(({ key, icon, label }) => (
                  <CardMetric
                    key={key}
                    icon={icon}
                    title={_(label)}
                    value={data?.current[key]}
                    testId={`analytics-${key}`}
                  >
                    {!data && <Skeleton className="mt-auto h-8 w-16" />}
                  </CardMetric>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const PERIOD_OPTIONS = [
  { value: 'day', label: <Trans>Day</Trans> },
  { value: 'week', label: <Trans>Week</Trans> },
  { value: 'month', label: <Trans>Month</Trans> },
  { value: 'year', label: <Trans>Year</Trans> },
];

const ACTIVITY_METRICS = [
  { key: 'sent', icon: SendIcon, label: msg`Documents Sent` },
  { key: 'completed', icon: FileCheckIcon, label: msg`Completed` },
  { key: 'declined', icon: FileXIcon, label: msg`Declined` },
  { key: 'cancelled', icon: BanIcon, label: msg`Cancelled` },
] as const;

const CURRENT_METRICS = [
  { key: 'draft', icon: FileEditIcon, label: msg`Draft` },
  { key: 'pending', icon: FileClockIcon, label: msg`Pending` },
] as const;

const WINDOW_FORMATS: Record<AnalyticsPeriod['unit'], Intl.DateTimeFormatOptions> = {
  day: { month: 'short', day: 'numeric', year: 'numeric' },
  week: { month: 'short', day: 'numeric', year: 'numeric' },
  month: { month: 'short', year: 'numeric' },
  year: { year: 'numeric' },
};

const formatWindow = (period: AnalyticsPeriod, options: Intl.DateTimeFormatOptions, locale: string) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: period.timezone }).formatRange(
    period.start,
    new Date(period.end.getTime() - 1),
  );
