type RepoStats = {
  stars: number;
  forks: number;
  mergedPRs: number;
  openIssues: number;
};

type DataEntry = {
  [key: string]: RepoStats;
};

type TransformedData = {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
};

type MonthNames = {
  [key: string]: string;
};

type MetricKey = keyof RepoStats;

const FRIENDLY_METRIC_NAMES: { [key in MetricKey]: string } = {
  stars: 'Stars',
  forks: 'Forks',
  mergedPRs: 'Merged PRs',
  openIssues: 'Open Issues',
};

export function transformRepoStats(data: DataEntry, metric: MetricKey): TransformedData {
  const sortedEntries = Object.entries(data).sort(([dateA], [dateB]) => {
    const [yearA, monthA] = dateA.split('-').map(Number);
    const [yearB, monthB] = dateB.split('-').map(Number);
    return new Date(yearA, monthA - 1).getTime() - new Date(yearB, monthB - 1).getTime();
  });

  const monthNames: MonthNames = {
    '1': 'Jan',
    '2': 'Feb',
    '3': 'Mar',
    '4': 'Apr',
    '5': 'May',
    '6': 'Jun',
    '7': 'Jul',
    '8': 'Aug',
    '9': 'Sep',
    '10': 'Oct',
    '11': 'Nov',
    '12': 'Dec',
  };

  const labels = sortedEntries.map(([date]) => {
    const [year, month] = date.split('-');
    const monthIndex = parseInt(month);
    return `${monthNames[monthIndex.toString()]} ${year}`;
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
