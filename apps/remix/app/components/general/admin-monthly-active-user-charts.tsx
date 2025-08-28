import { DateTime } from 'luxon';
import type { TooltipProps } from 'recharts';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

import type { GetMonthlyActiveUsersResult } from '@documenso/lib/server-only/admin/get-users-stats';

export type MonthlyActiveUsersChartProps = {
  className?: string;
  title: string;
  cummulative?: boolean;
  data: GetMonthlyActiveUsersResult;
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    return (
      <div className="z-100 w-60 space-y-1 rounded-md border border-solid bg-white p-2 px-3">
        <p>{label}</p>
        <p className="text-documenso">
          {payload[0].name === 'cume_count' ? 'Cumulative MAU' : 'Monthly Active Users'}:{' '}
          <span className="text-black">{Number(payload[0].value).toLocaleString('en-US')}</span>
        </p>
      </div>
    );
  }

  return null;
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

            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary) / 10%)' }} />

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
