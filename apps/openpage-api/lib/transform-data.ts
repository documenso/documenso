import { DateTime } from 'luxon';

import { addZeroMonth } from './add-zero-month';

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
  try {
    if (!data || Object.keys(data).length === 0) {
      return {
        labels: [],
        datasets: [{ label: `Total ${FRIENDLY_METRIC_NAMES[metric]}`, data: [] }],
      };
    }

    const sortedEntries = Object.entries(data).sort(([dateA], [dateB]) => {
      try {
        const [yearA, monthA] = dateA.split('-').map(Number);
        const [yearB, monthB] = dateB.split('-').map(Number);

        if (isNaN(yearA) || isNaN(monthA) || isNaN(yearB) || isNaN(monthB)) {
          console.warn(`Invalid date format: ${dateA} or ${dateB}`);
          return 0;
        }

        return DateTime.local(yearA, monthA).toMillis() - DateTime.local(yearB, monthB).toMillis();
      } catch (error) {
        console.error('Error sorting entries:', error);
        return 0;
      }
    });

    const labels = sortedEntries.map(([date]) => {
      try {
        const [year, month] = date.split('-');

        if (!year || !month || isNaN(Number(year)) || isNaN(Number(month))) {
          console.warn(`Invalid date format: ${date}`);
          return date;
        }

        const dateTime = DateTime.fromObject({
          year: Number(year),
          month: Number(month),
        });

        if (!dateTime.isValid) {
          console.warn(`Invalid DateTime object for: ${date}`);
          return date;
        }

        return dateTime.toFormat('MMM yyyy');
      } catch (error) {
        console.error('Error formatting date:', error, date);
        return date;
      }
    });

    const transformedData = {
      labels,
      datasets: [
        {
          label: `Total ${FRIENDLY_METRIC_NAMES[metric]}`,
          data: sortedEntries.map(([_, stats]) => {
            const value = stats[metric];
            return typeof value === 'number' && !isNaN(value) ? value : 0;
          }),
        },
      ],
    };

    return addZeroMonth(transformedData);
  } catch (error) {
    return {
      labels: [],
      datasets: [{ label: `Total ${FRIENDLY_METRIC_NAMES[metric]}`, data: [] }],
    };
  }
}

// To be on the safer side
export const transformRepoStats = transformData;
