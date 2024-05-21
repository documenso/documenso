'use client';

import { DateTime } from 'luxon';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { GetUserWithDocumentMonthlyGrowth } from '@documenso/lib/server-only/admin/get-users-stats';

export type UserWithDocumentChartProps = {
  className?: string;
  title: string;
  data: GetUserWithDocumentMonthlyGrowth;
  completed?: boolean;
  tooltip?: string;
};

export const UserWithDocumentChart = ({
  className,
  data,
  title,
  completed = false,
  tooltip,
}: UserWithDocumentChartProps) => {
  const formattedData = (data: GetUserWithDocumentMonthlyGrowth, completed: boolean) => {
    return [...data].reverse().map(({ month, count, signed_count }) => {
      const formattedMonth = DateTime.fromFormat(month, 'yyyy-MM').toFormat('LLL');
      if (completed) {
        return {
          month: formattedMonth,
          count: Number(signed_count),
        };
      } else {
        return {
          month: formattedMonth,
          count: Number(count),
        };
      }
    });
  };

  return (
    <div className={className}>
      <div className="border-border flex flex-1 flex-col justify-center rounded-2xl border p-6 pl-2">
        <div className="mb-6 flex h-12 px-4">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={formattedData(data, completed)}>
            <XAxis dataKey="month" />
            <YAxis />

            <Tooltip
              labelStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value) => [Number(value).toLocaleString('en-US'), tooltip]}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />

            <Bar
              dataKey="count"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
              label={tooltip}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
