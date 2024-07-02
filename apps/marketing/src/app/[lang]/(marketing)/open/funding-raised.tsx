'use client';

import type { HTMLAttributes } from 'react';

import type { getDictionary } from 'get-dictionary';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatMonth } from '@documenso/lib/client-only/format-month';
import type { stringLocales } from '@documenso/lib/internationalization/i18n-config';

export type FundingRaisedProps = HTMLAttributes<HTMLDivElement> & {
  data: Record<string, string | number>[];
  dictionary: {
    open_startup: Awaited<ReturnType<typeof getDictionary>>['open_startup'];
    stringLocale: stringLocales;
  };
};

export const FundingRaised = ({ className, data, dictionary, ...props }: FundingRaisedProps) => {
  const formattedData = data.map((item) => ({
    amount: Number(item.amount),
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    date: formatMonth(item.date as string, dictionary.stringLocale),
  }));

  return (
    <div className={className} {...props}>
      <div className="border-border flex flex-col justify-center rounded-2xl border p-6 pl-2 shadow-sm hover:shadow">
        <div className="mb-6 flex px-4">
          <h3 className="text-lg font-semibold">{dictionary.open_startup.total_funding}</h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={formattedData} margin={{ top: 40, right: 40, bottom: 20, left: 40 }}>
            <XAxis dataKey="date" />
            <YAxis
              tickFormatter={(value) =>
                Number(value).toLocaleString(dictionary.stringLocale, {
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
                Number(value).toLocaleString(dictionary.stringLocale, {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }),
                dictionary.open_startup.amount_raised,
              ]}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />
            <Bar
              dataKey="amount"
              fill="hsl(var(--primary))"
              label={dictionary.open_startup.amount_raised}
              maxBarSize={60}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
