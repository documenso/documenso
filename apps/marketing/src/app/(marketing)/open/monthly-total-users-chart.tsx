'use client';

import { DateTime } from 'luxon';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { GetUserMonthlyGrowthResult } from '@documenso/lib/server-only/user/get-user-monthly-growth';

export type MonthlyTotalUsersChartProps = {
  className?: string;
  data: GetUserMonthlyGrowthResult;
};

export const MonthlyTotalUsersChart = ({ className, data }: MonthlyTotalUsersChartProps) => {
  const formattedData = [...data].reverse().map(({ month, cume_count: count }) => {
    return {
      month: DateTime.fromFormat(month, 'yyyy-MM').toFormat('LLLL'),
      count: Number(count),
    };
  });

  return (
    <div className={className}>
      <div className="border-border flex flex-1 flex-col justify-center rounded-2xl border p-6 pl-2 shadow-sm hover:shadow">
        <div className="mb-6 flex px-4">
          <h3 className="text-lg font-semibold">Total Users</h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={formattedData}>
            <XAxis dataKey="month" />
            <YAxis />

            <Tooltip
              labelStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value) => [Number(value).toLocaleString('en-US'), 'Total Users']}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />

            <Bar
              dataKey="count"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
              label="Total Users"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
