import { DateTime } from 'luxon';

type MetricKeys = {
  stars: number;
  forks: number;
  mergedPRs: number;
  openIssues: number;
  earlyAdopters: number;
};

type DataEntry = {
  [key: string]: MetricKeys;
};

type TransformData = {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
};

type MetricKey = keyof MetricKeys;

const FRIENDLY_METRIC_NAMES: { [key in MetricKey]: string } = {
  stars: 'Stars',
  forks: 'Forks',
  mergedPRs: 'Merged PRs',
  openIssues: 'Open Issues',
  earlyAdopters: 'Customers',
};

export function transformData({
  data,
  metric,
}: {
  data: DataEntry;
  metric: MetricKey;
}): TransformData {
  const sortedEntries = Object.entries(data).sort(([dateA], [dateB]) => {
    const [yearA, monthA] = dateA.split('-').map(Number);
    const [yearB, monthB] = dateB.split('-').map(Number);

    return DateTime.local(yearA, monthA).toMillis() - DateTime.local(yearB, monthB).toMillis();
  });

  const labels = sortedEntries.map(([date]) => {
    const [year, month] = date.split('-');
    const dateTime = DateTime.fromObject({
      year: Number(year),
      month: Number(month),
    });
    return dateTime.toFormat('MMM yyyy');
  });

  return {
    labels,
    datasets: [
      {
        label: `Total ${FRIENDLY_METRIC_NAMES[metric]}`,
        data: sortedEntries.map(([_, stats]) => stats[metric]),
      },
    ],
  };
}

// To be on the safer side
export const transformRepoStats = transformData;
