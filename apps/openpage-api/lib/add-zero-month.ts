import { DateTime } from 'luxon';

export interface TransformedData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
}

export function addZeroMonth(transformedData: TransformedData): TransformedData {
  const result = {
    labels: [...transformedData.labels],
    datasets: transformedData.datasets.map((dataset) => ({
      label: dataset.label,
      data: [...dataset.data],
    })),
  };

  if (result.labels.length === 0) {
    return result;
  }

  if (result.datasets.every((dataset) => dataset.data[0] === 0)) {
    return result;
  }

  try {
    let firstMonth = DateTime.fromFormat(result.labels[0], 'MMM yyyy');
    if (!firstMonth.isValid) {
      const formats = ['MMM yyyy', 'MMMM yyyy', 'MM/yyyy', 'yyyy-MM'];

      for (const format of formats) {
        firstMonth = DateTime.fromFormat(result.labels[0], format);
        if (firstMonth.isValid) break;
      }

      if (!firstMonth.isValid) {
        console.warn(`Could not parse date: "${result.labels[0]}"`);
        return transformedData;
      }
    }

    const zeroMonth = firstMonth.minus({ months: 1 }).toFormat('MMM yyyy');
    result.labels.unshift(zeroMonth);
    result.datasets.forEach((dataset) => {
      dataset.data.unshift(0);
    });

    return result;
  } catch (error) {
    return transformedData;
  }
}
