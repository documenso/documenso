import type { Metadata } from 'next';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { z } from 'zod';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getCompletedDocumentsMonthly } from '@documenso/lib/server-only/user/get-monthly-completed-document';
import { getUserMonthlyGrowth } from '@documenso/lib/server-only/user/get-user-monthly-growth';

import { FUNDING_RAISED } from '~/app/(marketing)/open/data';
import { CallToAction } from '~/components/(marketing)/call-to-action';

import { BarMetric } from './bar-metrics';
import { CapTable } from './cap-table';
import { FundingRaised } from './funding-raised';
import { MetricCard } from './metric-card';
import { MonthlyCompletedDocumentsChart } from './monthly-completed-documents-chart';
import { MonthlyNewUsersChart } from './monthly-new-users-chart';
import { MonthlyTotalUsersChart } from './monthly-total-users-chart';
import { SalaryBands } from './salary-bands';
import { TeamMembers } from './team-members';
import { OpenPageTooltip } from './tooltip';
import { TotalSignedDocumentsChart } from './total-signed-documents-chart';
import { Typefully } from './typefully';

export const metadata: Metadata = {
  title: 'Open Startup',
};

export const revalidate = 3600;

export const dynamic = 'force-dynamic';

const GITHUB_HEADERS: Record<string, string> = {
  accept: 'application/vnd.github.v3+json',
};

if (process.env.NEXT_PRIVATE_GITHUB_TOKEN) {
  GITHUB_HEADERS.authorization = `Bearer ${process.env.NEXT_PRIVATE_GITHUB_TOKEN}`;
}

const ZGithubStatsResponse = z.object({
  stargazers_count: z.number(),
  forks_count: z.number(),
  open_issues: z.number(),
});

const ZMergedPullRequestsResponse = z.object({
  total_count: z.number(),
});

const ZOpenIssuesResponse = z.object({
  total_count: z.number(),
});

const ZStargazersLiveResponse = z.record(
  z.object({
    stars: z.number(),
    forks: z.number(),
    mergedPRs: z.number(),
    openIssues: z.number(),
  }),
);

const ZEarlyAdoptersResponse = z.record(
  z.object({
    id: z.number(),
    time: z.string().datetime(),
    earlyAdopters: z.number(),
  }),
);

export type StargazersType = z.infer<typeof ZStargazersLiveResponse>;
export type EarlyAdoptersType = z.infer<typeof ZEarlyAdoptersResponse>;

const fetchGithubStats = async () => {
  return await fetch('https://api.github.com/repos/documenso/documenso', {
    headers: {
      ...GITHUB_HEADERS,
    },
  })
    .then(async (res) => res.json())
    .then((res) => ZGithubStatsResponse.parse(res));
};

const fetchOpenIssues = async () => {
  return await fetch(
    'https://api.github.com/search/issues?q=repo:documenso/documenso+type:issue+state:open&page=0&per_page=1',
    {
      headers: {
        ...GITHUB_HEADERS,
      },
    },
  )
    .then(async (res) => res.json())
    .then((res) => ZOpenIssuesResponse.parse(res));
};

const fetchMergedPullRequests = async () => {
  return await fetch(
    'https://api.github.com/search/issues?q=repo:documenso/documenso/+is:pr+merged:>=2010-01-01&page=0&per_page=1',
    {
      headers: {
        ...GITHUB_HEADERS,
      },
    },
  )
    .then(async (res) => res.json())
    .then((res) => ZMergedPullRequestsResponse.parse(res));
};

const fetchStargazers = async () => {
  return await fetch('https://stargrazer-live.onrender.com/api/stats', {
    headers: {
      accept: 'application/json',
    },
  })
    .then(async (res) => res.json())
    .then((res) => ZStargazersLiveResponse.parse(res));
};

const fetchEarlyAdopters = async () => {
  return await fetch('https://stargrazer-live.onrender.com/api/stats/stripe', {
    headers: {
      accept: 'application/json',
    },
  })
    .then(async (res) => res.json())
    .then((res) => ZEarlyAdoptersResponse.parse(res));
};

export default async function OpenPage() {
  await setupI18nSSR();

  const { _ } = useLingui();

  const [
    { forks_count: forksCount, stargazers_count: stargazersCount },
    { total_count: openIssues },
    { total_count: mergedPullRequests },
    STARGAZERS_DATA,
    EARLY_ADOPTERS_DATA,
    MONTHLY_USERS,
    MONTHLY_COMPLETED_DOCUMENTS,
  ] = await Promise.all([
    fetchGithubStats(),
    fetchOpenIssues(),
    fetchMergedPullRequests(),
    fetchStargazers(),
    fetchEarlyAdopters(),
    getUserMonthlyGrowth(),
    getCompletedDocumentsMonthly(),
  ]);

  return (
    <div>
      <div className="mx-auto mt-6 max-w-screen-lg sm:mt-12">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold lg:text-5xl">
            <Trans>Open Startup</Trans>
          </h1>

          <p className="text-muted-foreground mt-4 max-w-[60ch] text-center text-lg leading-normal">
            <Trans>
              All our metrics, finances, and learnings are public. We believe in transparency and
              want to share our journey with you. You can read more about why here:{' '}
              <a
                className="font-bold"
                href="https://documenso.com/blog/pre-seed"
                target="_blank"
                rel="noreferrer"
              >
                Announcing Open Metrics
              </a>
            </Trans>
          </p>
        </div>

        <div className="my-12 grid grid-cols-12 gap-8">
          <div className="col-span-12 grid grid-cols-4 gap-4">
            <MetricCard
              className="col-span-2 lg:col-span-1"
              title="Stargazers"
              value={stargazersCount.toLocaleString('en-US')}
            />
            <MetricCard
              className="col-span-2 lg:col-span-1"
              title="Forks"
              value={forksCount.toLocaleString('en-US')}
            />
            <MetricCard
              className="col-span-2 lg:col-span-1"
              title={_(msg`Open Issues`)}
              value={openIssues.toLocaleString('en-US')}
            />
            <MetricCard
              className="col-span-2 lg:col-span-1"
              title={_(msg`Merged PR's`)}
              value={mergedPullRequests.toLocaleString('en-US')}
            />
          </div>

          <TeamMembers className="col-span-12" />

          <SalaryBands className="col-span-12" />
        </div>

        <h2 className="px-4 text-2xl font-semibold">
          <Trans>Finances</Trans>
        </h2>
        <div className="mb-12 mt-4 grid grid-cols-12 gap-8">
          <FundingRaised data={FUNDING_RAISED} className="col-span-12 lg:col-span-6" />

          <CapTable className="col-span-12 lg:col-span-6" />
        </div>

        <h2 className="px-4 text-2xl font-semibold">
          <Trans>Community</Trans>
        </h2>
        <div className="mb-12 mt-4 grid grid-cols-12 gap-8">
          <BarMetric<StargazersType>
            data={STARGAZERS_DATA}
            metricKey="stars"
            title={_(msg`GitHub: Total Stars`)}
            label={_(msg`Stars`)}
            className="col-span-12 lg:col-span-6"
          />

          <BarMetric<StargazersType>
            data={STARGAZERS_DATA}
            metricKey="mergedPRs"
            title={_(msg`GitHub: Total Merged PRs`)}
            label={_(msg`Merged PRs`)}
            chartHeight={400}
            className="col-span-12 lg:col-span-6"
          />

          <BarMetric<StargazersType>
            data={STARGAZERS_DATA}
            metricKey="forks"
            title="GitHub: Total Forks"
            label="Forks"
            chartHeight={400}
            className="col-span-12 lg:col-span-6"
          />

          <BarMetric<StargazersType>
            data={STARGAZERS_DATA}
            metricKey="openIssues"
            title={_(msg`GitHub: Total Open Issues`)}
            label={_(msg`Open Issues`)}
            chartHeight={400}
            className="col-span-12 lg:col-span-6"
          />

          <Typefully className="col-span-12 lg:col-span-6" />
        </div>

        <h2 className="px-4 text-2xl font-semibold">
          <Trans>Growth</Trans>
        </h2>
        <div className="mb-12 mt-4 grid grid-cols-12 gap-8">
          <BarMetric<EarlyAdoptersType>
            data={EARLY_ADOPTERS_DATA}
            metricKey="earlyAdopters"
            title={_(msg`Total Customers`)}
            label={_(msg`Total Customers`)}
            className="col-span-12 lg:col-span-6"
            extraInfo={<OpenPageTooltip />}
          />

          <MonthlyTotalUsersChart data={MONTHLY_USERS} className="col-span-12 lg:col-span-6" />
          <MonthlyNewUsersChart data={MONTHLY_USERS} className="col-span-12 lg:col-span-6" />

          <MonthlyCompletedDocumentsChart
            data={MONTHLY_COMPLETED_DOCUMENTS}
            className="col-span-12 lg:col-span-6"
          />
          <TotalSignedDocumentsChart
            data={MONTHLY_COMPLETED_DOCUMENTS}
            className="col-span-12 lg:col-span-6"
          />
        </div>
      </div>

      <div className="col-span-12 mt-12 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold">
          <Trans>Is there more?</Trans>
        </h2>

        <p className="text-muted-foreground mt-4 max-w-[55ch] text-center text-lg leading-normal">
          <Trans>
            This page is evolving as we learn what makes a great signing company. We'll update it
            when we have more to share.
          </Trans>
        </p>
      </div>

      <CallToAction className="mt-12" utmSource="open-page" />
    </div>
  );
}
