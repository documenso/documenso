'use client';

import { HTMLAttributes } from 'react';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatMonth } from '@documenso/lib/client-only/format-month';
import { cn } from '@documenso/ui/lib/utils';

import { StargazersType } from './page';

export type GithubOpenIssuesProps = HTMLAttributes<HTMLDivElement> & { data: StargazersType };

export const GithubOpenIssues = ({ className, data, ...props }: GithubOpenIssuesProps) => {
  const formattedData = Object.keys(data)
    .map((key) => ({
      month: formatMonth(key),
      openIssues: data[key].openIssues,
    }))
    .reverse();

  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <h3 className="px-4 text-lg font-semibold">Github: Open Issues</h3>

      <div className="border-border mt-2.5 flex flex-1 items-center justify-center rounded-2xl border shadow-sm hover:shadow">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={formattedData} margin={{ top: 40, right: 20 }}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              itemStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value) => [Number(value), 'Open Issues']}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />
            <Bar dataKey="openIssues" fill="hsl(var(--primary))" label="Open Issues" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
