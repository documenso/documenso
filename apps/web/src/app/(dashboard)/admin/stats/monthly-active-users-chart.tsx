'use client';

import { DateTime } from 'luxon';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { GetMonthlyActiveUsersResult } from '@documenso/lib/server-only/admin/get-users-stats';

export type MonthlyActiveUsersChartProps = {
  className?: string;
  title: string;
  cummulative?: boolean;
  data: GetMonthlyActiveUsersResult;
};

export const MonthlyActiveUsersChart = ({
  className,
  data,
  title,
  cummulative = false,
}: MonthlyActiveUsersChartProps) => {
  const formattedData = [...data].reverse().map(({ month, count, cume_count }) => {
    return {
      month: DateTime.fromFormat(month, 'yyyy-MM').toFormat('MMM yyyy'),
      count: Number(count),
      cume_count: Number(cume_count),
    };
  });

  return (
    <div className={className}>
      <div className="border-border flex flex-1 flex-col justify-center rounded-2xl border p-6 pl-2">
        <div className="mb-6 flex px-4">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={formattedData}>
            <XAxis dataKey="month" />
            <YAxis />

            <Tooltip
              labelStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value) => [
                Number(value).toLocaleString('en-US'),
                cummulative ? 'Cumulative MAU' : 'Monthly Active Users',
              ]}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />

            <Bar
              dataKey={cummulative ? 'cume_count' : 'count'}
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
              label={cummulative ? 'Cumulative MAU' : 'Monthly Active Users'}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
