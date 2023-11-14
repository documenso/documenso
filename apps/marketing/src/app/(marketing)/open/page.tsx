import { z } from 'zod';

import { getUserMonthlyGrowth } from '@documenso/lib/server-only/user/get-user-monthly-growth';

import { FUNDING_RAISED } from '~/app/(marketing)/open/data';
import { MetricCard } from '~/app/(marketing)/open/metric-card';
import { SalaryBands } from '~/app/(marketing)/open/salary-bands';

import { BarMetric } from './bar-metrics';
import { CapTable } from './cap-table';
import { FundingRaised } from './funding-raised';
import { MonthlyNewUsersChart } from './monthly-new-users-chart';
import { MonthlyTotalUsersChart } from './monthly-total-users-chart';
import { TeamMembers } from './team-members';
import { OpenPageTooltip } from './tooltip';

export const revalidate = 3600;

export const dynamic = 'force-dynamic';

const ZGithubStatsResponse = z.object({
  stargazers_count: z.number(),
  forks_count: z.number(),
  open_issues: z.number(),
});

const ZMergedPullRequestsResponse = z.object({
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

export default async function OpenPage() {
  const GITHUB_HEADERS: Record<string, string> = {
    accept: 'application/vnd.github.v3+json',
  };

  if (process.env.NEXT_PRIVATE_GITHUB_TOKEN) {
    GITHUB_HEADERS.authorization = `Bearer ${process.env.NEXT_PRIVATE_GITHUB_TOKEN}`;
  }

  const {
    forks_count: forksCount,
    open_issues: openIssues,
    stargazers_count: stargazersCount,
  } = await fetch('https://api.github.com/repos/documenso/documenso', {
    headers: GITHUB_HEADERS,
  })
    .then(async (res) => res.json())
    .then((res) => ZGithubStatsResponse.parse(res));

  const { total_count: mergedPullRequests } = await fetch(
    'https://api.github.com/search/issues?q=repo:documenso/documenso/+is:pr+merged:>=2010-01-01&page=0&per_page=1',
    {
      headers: GITHUB_HEADERS,
    },
  )
    .then(async (res) => res.json())
    .then((res) => ZMergedPullRequestsResponse.parse(res));

  const STARGAZERS_DATA = await fetch('https://stargrazer-live.onrender.com/api/stats', {
    headers: {
      accept: 'application/json',
    },
  })
    .then(async (res) => res.json())
    .then((res) => ZStargazersLiveResponse.parse(res));

  const EARLY_ADOPTERS_DATA = await fetch('https://stargrazer-live.onrender.com/api/stats/stripe', {
    headers: {
      accept: 'application/json',
    },
  })
    .then(async (res) => res.json())
    .then((res) => ZEarlyAdoptersResponse.parse(res));

  const MONTHLY_USERS = await getUserMonthlyGrowth();

  return (
    <div className="mx-auto mt-6 max-w-screen-lg sm:mt-12">
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold lg:text-5xl">Open Startup</h1>

        <p className="text-muted-foreground mt-4 max-w-[60ch] text-center text-lg leading-normal">
          All our metrics, finances, and learnings are public. We believe in transparency and want
          to share our journey with you. You can read more about why here:{' '}
          <a className="font-bold" href="https://documenso.com/blog/pre-seed" target="_blank">
            Announcing Open Metrics
          </a>
        </p>
      </div>

      <div className="mt-12 grid grid-cols-12 gap-8">
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
            title="Open Issues"
            value={openIssues.toLocaleString('en-US')}
          />
          <MetricCard
            className="col-span-2 lg:col-span-1"
            title="Merged PR's"
            value={mergedPullRequests.toLocaleString('en-US')}
          />
        </div>

        <TeamMembers className="col-span-12" />

        <SalaryBands className="col-span-12" />

        <FundingRaised data={FUNDING_RAISED} className="col-span-12 lg:col-span-6" />

        <CapTable className="col-span-12 lg:col-span-6" />

        <BarMetric<EarlyAdoptersType>
          data={EARLY_ADOPTERS_DATA}
          metricKey="earlyAdopters"
          title="Early Adopters"
          label="Early Adopters"
          className="col-span-12 lg:col-span-6"
          extraInfo={<OpenPageTooltip />}
        />

        <BarMetric<StargazersType>
          data={STARGAZERS_DATA}
          metricKey="stars"
          title="Github: Total Stars"
          label="Stars"
          className="col-span-12 lg:col-span-6"
        />

        <BarMetric<StargazersType>
          data={STARGAZERS_DATA}
          metricKey="mergedPRs"
          title="Github: Total Merged PRs"
          label="Merged PRs"
          chartHeight={300}
          className="col-span-12 lg:col-span-6"
        />

        <BarMetric<StargazersType>
          data={STARGAZERS_DATA}
          metricKey="forks"
          title="Github: Total Forks"
          label="Forks"
          chartHeight={300}
          className="col-span-12 lg:col-span-6"
        />

        <BarMetric<StargazersType>
          data={STARGAZERS_DATA}
          metricKey="openIssues"
          title="Github: Total Open Issues"
          label="Open Issues"
          chartHeight={300}
          className="col-span-12 lg:col-span-6"
        />

        <MonthlyTotalUsersChart data={MONTHLY_USERS} className="col-span-12 lg:col-span-6" />
        <MonthlyNewUsersChart data={MONTHLY_USERS} className="col-span-12 lg:col-span-6" />

        <div className="col-span-12 mt-12 flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold">Where's the rest?</h2>

          <p className="text-muted-foreground mt-4 max-w-[55ch] text-center text-lg leading-normal">
            We're still working on getting all our metrics together. We'll update this page as soon
            as we have more to share.
          </p>
        </div>
      </div>
    </div>
  );
}
