'use client';

import { HTMLAttributes } from 'react';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatMonth } from '@documenso/lib/client-only/format-month';
import { cn } from '@documenso/ui/lib/utils';

export type BarMetricProps<T extends Record<string, unknown>> = HTMLAttributes<HTMLDivElement> & {
  data: T;
  metricKey: keyof T[string];
  title: string;
  label: string;
  chartHeight?: number;
};

export const BarMetric = <T extends Record<string, Record<keyof T[string], unknown>>>({
  className,
  data,
  metricKey,
  title,
  label,
  chartHeight = 400,
  ...props
}: BarMetricProps<T>) => {
  const formattedData = Object.keys(data)
    .map((key) => ({
      month: formatMonth(key),
      [metricKey]: data[key][metricKey],
    }))
    .reverse();

  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <h3 className="px-4 text-lg font-semibold">{title}</h3>

      <div className="border-border mt-2.5 flex flex-1 items-center justify-center rounded-2xl border pr-2 shadow-sm hover:shadow">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={formattedData} margin={{ top: 30, right: 20 }}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              itemStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value) => [Number(value), label]}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />
            <Bar dataKey={metricKey as string} fill="hsl(var(--primary))" label={label} />{' '}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
