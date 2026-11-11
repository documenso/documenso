import type { DateRange } from '@documenso/lib/types/search-params';
import { useEffect } from 'react';
import { useFetcher } from 'react-router';

import type { loader } from '~/routes/_authenticated+/admin+/organisation-insights.$id';

type UseAdminOrganisationInsightsOptions = {
  organisationId: string;
  view: 'teams' | 'users' | 'documents';
  page?: number;
  perPage?: number;
  dateRange?: DateRange;
};

/**
 * Reads the loader of the organisation insights page, so the admin organisation
 * page shows the same documents and counts without a second query path.
 */
export const useAdminOrganisationInsights = ({
  organisationId,
  view,
  page = 1,
  perPage = 10,
  dateRange = 'allTime',
}: UseAdminOrganisationInsightsOptions) => {
  const fetcher = useFetcher<typeof loader>();

  const search = new URLSearchParams({ view, page: String(page), perPage: String(perPage), dateRange });
  const href = `/admin/organisation-insights/${organisationId}?${search}`;

  useEffect(() => {
    void fetcher.load(href);
  }, [href]);

  return {
    insights: fetcher.data?.insights,
    isLoading: fetcher.state !== 'idle',
  };
};
