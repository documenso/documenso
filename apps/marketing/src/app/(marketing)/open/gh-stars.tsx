'use client';

import { HTMLAttributes } from 'react';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { cn } from '@documenso/ui/lib/utils';

type StargazersType = {
  [key: string]: {
    stars?: number;
    forks?: number;
    mergedPRs?: number;
    openIssues?: number;
  };
};

const data: StargazersType = {
  '2023-8': {
    stars: 2483,
    forks: 155,
    mergedPRs: 87,
    openIssues: 67,
  },
  '2023-7': {
    stars: 2250,
    forks: 0,
    mergedPRs: 0,
    openIssues: 0,
  },
  '2023-6': {
    stars: 2070,
    forks: 0,
    mergedPRs: 0,
    openIssues: 0,
  },
  '2023-5': {
    stars: 1260,
    forks: 0,
    mergedPRs: 0,
    openIssues: 0,
  },
  '2023-4': {
    stars: 90,
    forks: 0,
    mergedPRs: 0,
    openIssues: 0,
  },
  '2023-3': {
    stars: 0,
    forks: 0,
    mergedPRs: 0,
    openIssues: 0,
  },
};

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
}

const formattedData = Object.keys(data)
  .map((key) => ({
    month: formatMonth(key),
    stars: data[key].stars,
  }))
  .reverse();

export type GithubStarsProps = HTMLAttributes<HTMLDivElement>;

export const GithubStars = ({ className, ...props }: GithubStarsProps) => {
  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <h3 className="px-4 text-lg font-semibold">Github Monthly Stars</h3>

      <div className="border-border mt-2.5 flex flex-1 items-center justify-center rounded-2xl border shadow-sm hover:shadow">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={formattedData} margin={{ top: 40, right: 40, bottom: 20, left: 40 }}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              itemStyle={{
                color: 'hsl(var(--primary-foreground))',
              }}
              formatter={(value) => [Number(value), 'Stars']}
              cursor={{ fill: 'hsl(var(--primary) / 10%)' }}
            />
            <Bar dataKey="stars" fill="hsl(var(--primary))" label="Stars" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
