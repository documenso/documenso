import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Input } from '@documenso/ui/primitives/input';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { SettingsHeader } from '~/components/general/settings-header';
import {
  AdminOrganisationStatsTable,
  type OrganisationStatsDisplayMode,
} from '~/components/tables/admin-organisation-stats-table';

const ALL_CLAIMS_VALUE = 'all';

/**
 * The earliest UTC calendar month for which stats exist (the month the feature launched).
 * Months before this never have data, so there's no point offering them in the filter.
 */
const EARLIEST_PERIOD = { year: 2026, month: 5 };

/**
 * Generate every UTC calendar month from `EARLIEST_PERIOD` up to the current month as
 * `YYYY-MM` strings, newest first.
 */
const generatePeriodOptions = (): string[] => {
  const periods: string[] = [];
  const now = new Date();

  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;

  while (year > EARLIEST_PERIOD.year || (year === EARLIEST_PERIOD.year && month >= EARLIEST_PERIOD.month)) {
    periods.push(`${year}-${String(month).padStart(2, '0')}`);

    month -= 1;

    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return periods;
};

export default function OrganisationStats() {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const [displayMode, setDisplayMode] = useState<OrganisationStatsDisplayMode>('usage');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  const periodOptions = useMemo(() => generatePeriodOptions(), []);

  const selectedPeriod = searchParams?.get('period') ?? currentMonthlyPeriod();
  const selectedClaim = searchParams?.get('claimId') ?? ALL_CLAIMS_VALUE;

  const { data: claimsData, isLoading: isLoadingClaims } = trpc.admin.claims.find.useQuery({
    perPage: 100,
  });

  const claimOptions = claimsData?.data ?? [];

  /**
   * Handle debouncing the search query.
   */
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString());

    params.set('query', debouncedSearchQuery);

    if (debouncedSearchQuery === '') {
      params.delete('query');
    }

    if ((searchParams?.get('query') || '') !== debouncedSearchQuery) {
      params.delete('page');
    }

    // If nothing to change then do nothing.
    if (params.toString() === searchParams?.toString()) {
      return;
    }

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  const onPeriodChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString());

    params.set('period', value);
    params.delete('page');

    setSearchParams(params);
  };

  const onClaimChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString());

    if (value === ALL_CLAIMS_VALUE) {
      params.delete('claimId');
    } else {
      params.set('claimId', value);
    }

    params.delete('page');

    setSearchParams(params);
  };

  return (
    <div>
      <SettingsHeader
        hideDivider
        title={t`Organisation Stats`}
        subtitle={t`View, sort and filter monthly usage stats across organisations`}
      />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <Input
          defaultValue={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t`Search by organisation name, URL or ID`}
          className="flex-1"
        />

        <Select value={selectedClaim} onValueChange={onClaimChange}>
          <SelectTrigger className="w-full sm:w-48" loading={isLoadingClaims}>
            <SelectValue placeholder={t`All claims`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLAIMS_VALUE}>{t`All claims`}</SelectItem>
            {claimOptions.map((claim) => (
              <SelectItem key={claim.id} value={claim.id}>
                {claim.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPeriod} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t`Period`} />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((period) => (
              <SelectItem key={period} value={period}>
                {period}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        <AdminOrganisationStatsTable displayMode={displayMode} />
      </div>

      <RadioGroup
        value={displayMode}
        onValueChange={(value) =>
          setDisplayMode(value === 'quotas' ? 'quotas' : value === 'averages' ? 'averages' : 'usage')
        }
        className="mt-4 flex flex-col gap-3 rounded-lg border border-border p-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem id="display-usage" value="usage" />
          <label htmlFor="display-usage" className="text-muted-foreground text-sm">
            <Trans>Show usage</Trans>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <RadioGroupItem id="display-quotas" value="quotas" />
          <label htmlFor="display-quotas" className="text-muted-foreground text-sm">
            <Trans>Show usage with quotas</Trans>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <RadioGroupItem id="display-averages" value="averages" />
          <label htmlFor="display-averages" className="text-muted-foreground text-sm">
            <Trans>Show daily averages for documents, emails and API usages</Trans>
          </label>
        </div>
      </RadioGroup>

      <Alert variant="neutral" className="mt-4">
        <AlertDescription>
          <Trans>
            Documents, emails and api values may not be accurate since they record the amount of times the action was
            attempted. Meaning these values may go over the actual quota, get rejected, and will still be recorded.
          </Trans>
        </AlertDescription>
      </Alert>
    </div>
  );
}
