'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { stringLocales } from '@documenso/lib/internationalization';
import type { GetUserMonthlyGrowthResult } from '@documenso/lib/server-only/user/get-user-monthly-growth';

import { useDictionary } from '~/providers/dictionary-provider';

export type MonthlyTotalUsersChartProps = {
  className?: string;
  data: GetUserMonthlyGrowthResult;
  stringLocale: stringLocales;
};

export const MonthlyTotalUsersChart = ({
  className,
  data,
  stringLocale,
}: MonthlyTotalUsersChartProps) => {
  const formattedData = [...data].reverse().map(({ month, cume_count: count }) => {
    return {
      month: new Intl.DateTimeFormat(stringLocale, { month: 'long' }).format(new Date(month)),
      count: Number(count),
    };
  });
  const dictionary = useDictionary();
  return (
    <div className={className}>
      <div className="border-border flex flex-1 flex-col justify-center rounded-2xl border p-6 pl-2 shadow-sm hover:shadow">
        <div className="mb-6 flex px-4">
          <h3 className="text-lg font-semibold">{dictionary.open_startup.total_users}</h3>
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
                Number(value).toLocaleString(stringLocale),
                dictionary.open_startup.total_users,
              ]}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />

            <Bar
              dataKey="count"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
              label={dictionary.open_startup.total_users}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
