import { Card, CardContent } from '@documenso/ui/primitives/card';

import { CallToAction } from '~/components/(marketing)/call-to-action';

// export const metadata: Metadata = {
//   title: 'Open Startup',
// };

// export const revalidate = 3600;

// export const dynamic = 'force-dynamic';

// const GITHUB_HEADERS: Record<string, string> = {
//   accept: 'application/vnd.github.v3+json',
// };

// if (process.env.NEXT_PRIVATE_GITHUB_TOKEN) {
//   GITHUB_HEADERS.authorization = `Bearer ${process.env.NEXT_PRIVATE_GITHUB_TOKEN}`;
// }

// const ZGithubStatsResponse = z.object({
//   stargazers_count: z.number(),
//   forks_count: z.number(),
//   open_issues: z.number(),
// });

// const ZMergedPullRequestsResponse = z.object({
//   total_count: z.number(),
// });

// const ZOpenIssuesResponse = z.object({
//   total_count: z.number(),
// });

// const ZStargazersLiveResponse = z.record(
//   z.object({
//     stars: z.number(),
//     forks: z.number(),
//     mergedPRs: z.number(),
//     openIssues: z.number(),
//   }),
// );

// const ZEarlyAdoptersResponse = z.record(
//   z.object({
//     id: z.number(),
//     time: z.string().datetime(),
//     earlyAdopters: z.number(),
//   }),
// );

// export type StargazersType = z.infer<typeof ZStargazersLiveResponse>;
// export type EarlyAdoptersType = z.infer<typeof ZEarlyAdoptersResponse>;

// const fetchGithubStats = async () => {
//   return await fetch('https://api.github.com/repos/documenso/documenso', {
//     headers: {
//       ...GITHUB_HEADERS,
//     },
//   })
//     .then(async (res) => res.json())
//     .then((res) => ZGithubStatsResponse.parse(res));
// };

// const fetchOpenIssues = async () => {
//   return await fetch(
//     'https://api.github.com/search/issues?q=repo:documenso/documenso+type:issue+state:open&page=0&per_page=1',
//     {
//       headers: {
//         ...GITHUB_HEADERS,
//       },
//     },
//   )
//     .then(async (res) => res.json())
//     .then((res) => ZOpenIssuesResponse.parse(res));
// };

// const fetchMergedPullRequests = async () => {
//   return await fetch(
//     'https://api.github.com/search/issues?q=repo:documenso/documenso/+is:pr+merged:>=2010-01-01&page=0&per_page=1',
//     {
//       headers: {
//         ...GITHUB_HEADERS,
//       },
//     },
//   )
//     .then(async (res) => res.json())
//     .then((res) => ZMergedPullRequestsResponse.parse(res));
// };

// const fetchStargazers = async () => {
//   return await fetch('https://stargrazer-live.onrender.com/api/stats', {
//     headers: {
//       accept: 'application/json',
//     },
//   })
//     .then(async (res) => res.json())
//     .then((res) => ZStargazersLiveResponse.parse(res));
// };

// const fetchEarlyAdopters = async () => {
//   return await fetch('https://stargrazer-live.onrender.com/api/stats/stripe', {
//     headers: {
//       accept: 'application/json',
//     },
//   })
//     .then(async (res) => res.json())
//     .then((res) => ZEarlyAdoptersResponse.parse(res));
// };

export default function OpenPage() {
  // const [
  //   { forks_count: forksCount, stargazers_count: stargazersCount },
  //   { total_count: openIssues },
  //   { total_count: mergedPullRequests },
  //   STARGAZERS_DATA,
  //   EARLY_ADOPTERS_DATA,
  //   MONTHLY_USERS,
  //   MONTHLY_COMPLETED_DOCUMENTS,
  // ] = await Promise.all([
  //   fetchGithubStats(),
  //   fetchOpenIssues(),
  //   fetchMergedPullRequests(),
  //   fetchStargazers(),
  //   fetchEarlyAdopters(),
  //   getUserMonthlyGrowth(),
  //   getCompletedDocumentsMonthly(),
  // ]);

  return (
    <div>
      <div className="mx-auto mt-6 max-w-screen-lg sm:mt-12">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-center text-3xl font-bold lg:text-5xl">
            გაამარტივეთ თქვენი სამუშაო პროცესი ჩვენი ელექტორნული ხელმოწერების პლატფორმით
          </h1>

          <p className="text-muted-foreground mt-4 max-w-[60ch] text-center text-lg leading-normal">
            Empower your team to close deals faster, stay productive anywhere, and customize your
            experience. Suitable for all industries: Sales, HR, Real Estate, and more.{' '}
            {/* <a
              className="font-bold"
              href="https://documenso.com/blog/pre-seed"
              target="_blank"
              rel="noreferrer"
            >
              Announcing Open Metrics
            </a> */}
          </p>
        </div>

        {/* <div className="my-12 grid grid-cols-12 gap-8">
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
        </div>

        <h2 className="px-4 text-2xl font-semibold">Finances</h2>
        <div className="mb-12 mt-4 grid grid-cols-12 gap-8">
          <FundingRaised data={FUNDING_RAISED} className="col-span-12 lg:col-span-6" />

          <CapTable className="col-span-12 lg:col-span-6" />
        </div>

        <h2 className="px-4 text-2xl font-semibold">Community</h2>
        <div className="mb-12 mt-4 grid grid-cols-12 gap-8">
          <BarMetric<StargazersType>
            data={STARGAZERS_DATA}
            metricKey="stars"
            title="GitHub: Total Stars"
            label="Stars"
            className="col-span-12 lg:col-span-6"
          />

          <BarMetric<StargazersType>
            data={STARGAZERS_DATA}
            metricKey="mergedPRs"
            title="GitHub: Total Merged PRs"
            label="Merged PRs"
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
            title="GitHub: Total Open Issues"
            label="Open Issues"
            chartHeight={400}
            className="col-span-12 lg:col-span-6"
          />

          <Typefully className="col-span-12 lg:col-span-6" />
        </div>

        <h2 className="px-4 text-2xl font-semibold">Growth</h2>
        <div className="mb-12 mt-4 grid grid-cols-12 gap-8">
          <BarMetric<EarlyAdoptersType>
            data={EARLY_ADOPTERS_DATA}
            metricKey="earlyAdopters"
            title="Early Adopters"
            label="Early Adopters"
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
        </div> */}
      </div>

      <div className="col-span-12 mt-12 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold">Is there more?</h2>

        <p className="text-muted-foreground mt-4 max-w-[55ch] text-center text-lg leading-normal">
          This page is evolving as we learn what makes a great signing company. We'll update it when
          we have more to share.
        </p>
      </div>

      <CallToAction className="mt-12" utmSource="open-page" />

      <Card spotlight className="mt-12">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <h2 className="text-center text-2xl font-bold">Close More Deals, Faster</h2>

          <p className="text-muted-foreground mt-4 max-w-[55ch] text-center leading-normal">
            Prepare contracts quickly, send them for signature, and track the entire process
            digitally.
          </p>

          {/* <ul>
            <li> Benefits:</li>
            <li>Speed: Reduce contract preparation time.</li>
            <li>Efficiency: Track progress without paper.</li>
            <li>Anywhere Access: Convert, create, edit, approve, and sign documents from any device.</li>
          </ul> */}
        </CardContent>
      </Card>
    </div>
  );
}
