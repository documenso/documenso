'use client';

import { DateTime } from 'luxon';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { GetCompletedDocumentsMonthlyResult } from '@documenso/lib/server-only/user/get-monthly-completed-document';

export type MonthlyCompletedDocumentsChartProps = {
  className?: string;
  data: GetCompletedDocumentsMonthlyResult;
};

export const MonthlyCompletedDocumentsChart = ({
  className,
  data,
}: MonthlyCompletedDocumentsChartProps) => {
  const formattedData = [...data].reverse().map(({ month, count }) => {
    return {
      month: DateTime.fromFormat(month, 'yyyy-MM').toFormat('LLLL'),
      count: Number(count),
    };
  });

  return (
    <div className={className}>
      <div className="border-border flex flex-col justify-center rounded-2xl border p-6 pl-2 shadow-sm hover:shadow">
        <div className="mb-6 flex px-4">
          <h3 className="text-lg font-semibold">Completed Documents per Month</h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={formattedData}>
            <XAxis dataKey="month" />
            <YAxis />

            <Tooltip
              labelStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value) => [Number(value).toLocaleString('en-US'), 'Completed Documents']}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />

            <Bar
              dataKey="count"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
              label="Completed Documents"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
