'use client';

import { DateTime } from 'luxon';
import type { TooltipProps } from 'recharts';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

import type { GetMonthlyActiveUsersResult } from '@documenso/lib/server-only/admin/get-users-stats';
import { cn } from '@documenso/ui/lib/utils';

export type MonthlyActiveUsersChartProps = {
  className?: string;
  title: string;
  data: GetMonthlyActiveUsersResult;
  tooltip?: string;
};

const CustomTooltip = ({
  active,
  payload,
  label,
  tooltip,
}: TooltipProps<ValueType, NameType> & { tooltip?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="z-100 w-60 space-y-1 rounded-md border border-solid bg-white p-2 px-3">
        <p className="">{label}</p>
        <p className="text-documenso">
          {`${tooltip} : `}
          <span className="text-black">{payload[0].value}</span>
        </p>
      </div>
    );
  }

  return null;
};

export const MonthlyActiveUsersChart = ({
  className,
  title,
  data,
  tooltip,
}: MonthlyActiveUsersChartProps) => {
  const formattedData = (data: GetMonthlyActiveUsersResult) => {
    return [...data].reverse().map(({ month, count }) => ({
      month: DateTime.fromFormat(month, 'yyyy-MM').toFormat('LLL'),
      count: Number(count),
    }));
  };

  return (
    <div className={cn('flex w-full flex-col gap-y-4', className)}>
      <div className="flex flex-col gap-y-1">
        <h3 className="text-foreground text-lg font-medium">{title}</h3>
      </div>

      <div className="w-full">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={formattedData(data)}>
            <XAxis dataKey="month" />
            <YAxis />

            <Tooltip
              content={<CustomTooltip tooltip={tooltip} />}
              labelStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
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
