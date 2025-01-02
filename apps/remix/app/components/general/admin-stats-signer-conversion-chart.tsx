import { DateTime } from 'luxon';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { GetSignerConversionMonthlyResult } from '@documenso/lib/server-only/user/get-signer-conversion';

export type AdminStatsSignerConversionChartProps = {
  className?: string;
  title: string;
  cummulative?: boolean;
  data: GetSignerConversionMonthlyResult;
};

export const AdminStatsSignerConversionChart = ({
  className,
  data,
  title,
  cummulative = false,
}: AdminStatsSignerConversionChartProps) => {
  const formattedData = [...data].reverse().map(({ month, count, cume_count }) => {
    return {
      month: DateTime.fromFormat(month, 'yyyy-MM').toFormat('MMM yyyy'),
      count: Number(count),
      signed_count: Number(cume_count),
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
              formatter={(value, name) => [
                Number(value).toLocaleString('en-US'),
                name === 'Recipients',
              ]}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />

            <Bar
              dataKey={cummulative ? 'signed_count' : 'count'}
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
              label="Recipients"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
