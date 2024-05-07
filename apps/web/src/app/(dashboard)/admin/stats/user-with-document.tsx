'use client';

import { DateTime } from 'luxon';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { GetUserWithDocumentMonthlyGrowth } from '@documenso/lib/server-only/admin/get-users-stats';

export type UserWithDocumentChartProps = {
  className?: string;
  data: GetUserWithDocumentMonthlyGrowth;
};

export const UserWithDocumentChart = ({ className, data }: UserWithDocumentChartProps) => {
  const formattedData = [...data].reverse().map(({ month, count, signed_count }) => {
    return {
      month: DateTime.fromFormat(month, 'yyyy-MM').toFormat('LLL'),
      count: Number(count),
      signed_count: Number(signed_count),
    };
  });

  return (
    <div className={className}>
      <div className="border-border flex flex-1 flex-col justify-center rounded-2xl border p-6 pl-2">
        <div className="mb-6 flex px-4">
          <h3 className="text-lg font-semibold">Total Activity</h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={formattedData}>
            <XAxis dataKey="month" />
            <YAxis />

            <Tooltip
              labelStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value, name) => [
                Number(value).toLocaleString('en-US'),
                {
                  count: 'User with document',
                  signed_count: 'Users with signed document',
                }[name],
              ]}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />

            <Bar
              dataKey="signed_count"
              fill="hsl(var(--gold))"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
              label="Documents Added"
            />
            <Bar
              dataKey="count"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
              label="Documents Signed"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
