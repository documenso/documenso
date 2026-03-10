import { DateTime } from 'luxon';

export type TransformedData = {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
};

const FORMAT = 'MMM yyyy';

export const addZeroMonth = (
  transformedData: TransformedData,
  isCumulative = false,
): TransformedData => {
  const result: TransformedData = {
    labels: [...transformedData.labels],
    datasets: transformedData.datasets.map((dataset) => ({
      label: dataset.label,
      data: [...dataset.data],
    })),
  };

  if (result.labels.length === 0) {
    return result;
  }

  if (!result.datasets.every((dataset) => dataset.data[0] === 0)) {
    const firstMonth = DateTime.fromFormat(result.labels[0], FORMAT);
    if (!firstMonth.isValid) {
      console.warn(`Could not parse date: "${result.labels[0]}"`);
      return transformedData;
    }

    result.labels.unshift(firstMonth.minus({ months: 1 }).toFormat(FORMAT));
    result.datasets.forEach((dataset) => {
      dataset.data.unshift(0);
    });
  }

  const now = DateTime.now().startOf('month');
  const lastMonth = DateTime.fromFormat(result.labels[result.labels.length - 1], FORMAT);

  if (lastMonth.isValid && lastMonth.startOf('month') < now) {
    result.labels.push(now.toFormat(FORMAT));
    result.datasets.forEach((dataset) => {
      dataset.data.push(isCumulative ? dataset.data[dataset.data.length - 1] : 0);
    });
  }

  return result;
};
