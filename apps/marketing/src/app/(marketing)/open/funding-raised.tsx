'use client';

import { HTMLAttributes } from 'react';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatMonth } from '@documenso/lib/client-only/format-month';
import { cn } from '@documenso/ui/lib/utils';

export type FundingRaisedProps = HTMLAttributes<HTMLDivElement> & {
  data: Record<string, string | number>[];
};

export const FundingRaised = ({ className, data, ...props }: FundingRaisedProps) => {
  const formattedData = data.map((item) => ({
    amount: Number(item.amount),
    date: formatMonth(item.date as string),
  }));

  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <h3 className="px-4 text-lg font-semibold">Total Funding Raised</h3>

      <div className="border-border mt-2.5 flex flex-1 flex-col items-center justify-center rounded-2xl border p-6 pl-2 pt-12 shadow-sm hover:shadow">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={formattedData} margin={{ top: 40, right: 40, bottom: 20, left: 40 }}>
            <XAxis dataKey="date" />
            <YAxis
              tickFormatter={(value) =>
                Number(value).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                })
              }
            />
            <Tooltip
              labelStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              itemStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value) => [
                Number(value).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }),
                'Amount Raised',
              ]}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />
            <Bar
              dataKey="amount"
              fill="hsl(var(--primary))"
              label="Amount Raised"
              maxBarSize={60}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
