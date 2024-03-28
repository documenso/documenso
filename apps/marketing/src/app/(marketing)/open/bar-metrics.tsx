'use client';

import type { HTMLAttributes } from 'react';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatMonth } from '@documenso/lib/client-only/format-month';

export type BarMetricProps<T extends Record<string, unknown>> = HTMLAttributes<HTMLDivElement> & {
  data: T;
  metricKey: keyof T[string];
  title: string;
  label: string;
  chartHeight?: number;
  extraInfo?: JSX.Element;
};

export const BarMetric = <T extends Record<string, Record<keyof T[string], unknown>>>({
  className,
  data,
  metricKey,
  title,
  label,
  chartHeight = 400,
  extraInfo,
  ...props
}: BarMetricProps<T>) => {
  const formattedData = Object.keys(data)
    .map((key) => ({
      month: formatMonth(key),
      [metricKey]: data[key][metricKey],
    }))
    .reverse();

  return (
    <div className={className} {...props}>
      <div className="border-border flex flex-col justify-center rounded-2xl border p-6 pl-2 shadow-sm hover:shadow">
        <div className="mb-6 flex px-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <span>{extraInfo}</span>
        </div>

        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={formattedData}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              labelStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              itemStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value) => [Number(value), label]}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />
            <Bar
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              dataKey={metricKey as string}
              maxBarSize={60}
              fill="hsl(var(--primary))"
              label={label}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
