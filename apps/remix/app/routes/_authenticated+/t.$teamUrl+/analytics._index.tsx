import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { IS_TEAM_ANALYTICS_ENABLED } from '@documenso/lib/constants/app';
import { SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { type AnalyticsPeriod, resolveAnalyticsPeriod } from '@documenso/lib/utils/analytics-period';
import { canExecuteTeamAction, formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { ZGetTeamAnalyticsRequestSchema } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { skipToken } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, UserIcon } from 'lucide-react';
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
  const start = period ? DateTime.fromJSDate(period.start, { zone: period.timezone }) : undefined;
  const previousDate = start && period ? start.minus({ [`${period.unit}s`]: 1 }).toISODate() : null;
  const nextDate = start && period ? start.plus({ [`${period.unit}s`]: 1 }) : undefined;
  const numberFormat = new Intl.NumberFormat(i18n.locale);
  const metricLabels = {
    sent: _(msg`Documents Sent`),
    completed: _(msg`Completed`),
    declined: _(msg`Declined`),
    cancelled: _(msg`Cancelled`),
  };
  const coverageLabels = data?.incompleteMetrics.map((metric) => metricLabels[metric]).join(', ');
  const periodLabel = period
    ? `${DateTime.fromJSDate(period.start, { zone: period.timezone }).setLocale(i18n.locale).toLocaleString(DateTime.DATE_MED)} – ${DateTime.fromJSDate(period.end, { zone: period.timezone }).minus({ days: 1 }).setLocale(i18n.locale).toLocaleString(DateTime.DATE_MED)}`
    : '';

  const resetFilters = () => {
    void setFilters({
      period: 'month',
      date: DateTime.now().setZone(localTimezone).toISODate(),
      timezone: localTimezone,
      senderIds: null,
    });
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="font-semibold text-2xl">
          <Trans>Analytics</Trans>
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          <Trans>Document activity for {team.name}. Counts include documents you can access.</Trans>
        </p>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="analytics-period">
            <Trans>Period</Trans>
          </Label>
          <Select value={filters.period ?? ''} onValueChange={(value) => void setFilters({ period: value })}>
            <SelectTrigger id="analytics-period" data-testid="analytics-period" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="day">
                  <Trans>Day</Trans>
                </SelectItem>
                <SelectItem value="week">
                  <Trans>Week</Trans>
                </SelectItem>
                <SelectItem value="month">
                  <Trans>Month</Trans>
                </SelectItem>
                <SelectItem value="year">
                  <Trans>Year</Trans>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="analytics-date">
            <Trans>Date</Trans>
          </Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              className="w-10 px-0"
              aria-label={_(msg`Previous period`)}
              data-testid="analytics-previous"
              disabled={!previousDate}
              onClick={() => void setFilters({ date: previousDate })}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Input
              id="analytics-date"
              data-testid="analytics-date"
              type="date"
              className="w-40"
              value={filters.date ?? ''}
              max={today.toISODate() ?? undefined}
              aria-invalid={isInvalidFilter}
              onChange={(event) => void setFilters({ date: event.target.value })}
            />
            <Button
              variant="outline"
              className="w-10 px-0"
              aria-label={_(msg`Next period`)}
              data-testid="analytics-next"
              disabled={!nextDate || nextDate > today}
              onClick={() => void setFilters({ date: nextDate?.toISODate() ?? null })}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button
          variant="outline"
          data-testid="analytics-current"
          disabled={!today.isValid}
          onClick={() => void setFilters({ date: today.toISODate() })}
        >
          <Trans>Current period</Trans>
        </Button>
        <FilterPill
          multiple
          icon={UserIcon}
          label={<Trans>Owner</Trans>}
          value={selectedOwners.length ? selectedOwners.map(String) : ['all']}
          options={[
            { value: 'all', label: _(msg`All`) },
            ...(data?.owners ?? []).map((owner) => ({ value: String(owner.id), label: owner.name || owner.email })),
          ]}
          onChange={(values) => {
            const ownerIds =
              selectedOwners.length && values.includes('all') ? [] : values.filter((value) => value !== 'all');
            void setFilters({ senderIds: ownerIds.length ? ownerIds.join(',') : null });
          }}
          enableSearch
          searchPlaceholder={_(msg`Search owners`)}
          loading={!data}
          testId="analytics-owner-filter"
        />
        {filters.senderIds && (
          <Button variant="ghost" onClick={() => void setFilters({ senderIds: null })}>
            <Trans>Reset Owner filter</Trans>
          </Button>
        )}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
        {periodLabel && <span>{periodLabel}</span>}
        <span data-testid="analytics-timezone">
          <Trans>Timezone: {activeTimezone}</Trans>
        </span>
        {activeTimezone !== localTimezone && (
          <Button variant="link" className="h-auto p-0" onClick={() => void setFilters({ timezone: localTimezone })}>
            <Trans>Use local timezone</Trans>
          </Button>
        )}
      </div>
      {isLoading ? (
        <HydrateFallback />
      ) : isAccessDenied ? (
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
            <p>
              <Trans>
                These filters are not valid. Choose a past or current period, a valid timezone, and an available owner.
              </Trans>
            </p>
            <Button variant="outline" className="mt-3" onClick={resetFilters}>
              <Trans>Reset filters</Trans>
            </Button>
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
      ) : data ? (
        <div className="flex flex-col gap-6">
          {coverageLabels && (
            <Alert variant="neutral" role="status" data-testid="analytics-coverage">
              <AlertDescription>
                <Trans>
                  Some activity dates are unavailable. These activity totals can be incomplete: {coverageLabels}.
                </Trans>
              </AlertDescription>
            </Alert>
          )}
          <section aria-labelledby="analytics-activity-title">
            <h2 id="analytics-activity-title" className="mb-3 font-medium text-base">
              <Trans>Period activity</Trans>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(['sent', 'completed'] as const).map((metric) => (
                <CardMetric key={metric} title={metricLabels[metric]} className="h-auto max-h-none min-h-32">
                  <p
                    className="mt-auto break-all font-semibold text-4xl tabular-nums"
                    data-testid={`analytics-${metric}`}
                  >
                    {numberFormat.format(data.activity[metric])}
                  </p>
                </CardMetric>
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
              {(['declined', 'cancelled'] as const).map((metric) => (
                <div key={metric} className="min-w-0">
                  <dt className="text-muted-foreground text-sm">{metricLabels[metric]}</dt>
                  <dd
                    className="mt-1 break-all font-semibold text-2xl tabular-nums"
                    data-testid={`analytics-${metric}`}
                  >
                    {numberFormat.format(data.activity[metric])}
                  </dd>
                </div>
              ))}
            </dl>
            {!Object.values(data.activity).some((count) => count > 0) && data.hasDocuments && (
              <p className="mt-3 text-muted-foreground text-sm" data-testid="analytics-empty">
                <Trans>No document activity in this period.</Trans>
              </p>
            )}
            {!data.hasDocuments && selectedOwners.length > 0 && (
              <p className="mt-3 text-muted-foreground text-sm" data-testid="analytics-empty">
                <Trans>No documents match this Owner filter.</Trans>
              </p>
            )}
          </section>
          <section aria-labelledby="analytics-current-title">
            <h2 id="analytics-current-title" className="font-medium text-base">
              <Trans>Current documents</Trans>
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              <Trans>
                The date filter applies only to activity. These are the current documents for the selected owners.
              </Trans>
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
              <div className="min-w-0">
                <dt className="text-muted-foreground text-sm">
                  <Trans>Draft</Trans>
                </dt>
                <dd className="mt-1 break-all font-semibold text-2xl tabular-nums" data-testid="analytics-draft">
                  {numberFormat.format(data.current.draft)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground text-sm">
                  <Trans>Pending</Trans>
                </dt>
                <dd className="mt-1 break-all font-semibold text-2xl tabular-nums" data-testid="analytics-pending">
                  {numberFormat.format(data.current.pending)}
                </dd>
              </div>
            </dl>
          </section>
          {!data.hasDocuments && selectedOwners.length === 0 && (
            <div
              className="rounded-lg border border-border border-dashed p-6 text-center"
              data-testid="analytics-empty"
            >
              <h2 className="font-medium">
                <Trans>No documents to show yet</Trans>
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                <Trans>Send a document to start tracking your team's usage.</Trans>
              </p>
              <Button asChild className="mt-4">
                <Link to={formatDocumentsPath(team.url)}>
                  <Trans>Send a document</Trans>
                </Link>
              </Button>
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            <Trans>
              Updated{' '}
              {DateTime.fromJSDate(data.observedAt, { zone: activeTimezone })
                .setLocale(i18n.locale)
                .toLocaleString(DateTime.DATETIME_SHORT)}
              . Counts reflect current ownership and document access.
            </Trans>
          </p>
        </div>
      ) : null}
    </div>
  );
}
